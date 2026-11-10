import Foundation
import CreateML
import CoreML
import CoreGraphics
import TabularData

public struct StyleJudgeHead:Codable,Sendable {
    public var category:String;public var name:String;public var modelFile:String
    public var trainingRows:Int;public var holdoutRows:Int;public var accuracy:Double
    public var reviewedTrainingRows:Int;public var reviewedHoldoutRows:Int
    public var reviewedAccuracy:Double?
}
public struct StyleJudgeTraining:Codable,Sendable {
    public var version="style-judges-v1"
    public var projection="vision-r2-scaleFit-signed-bucket-64-l2-v1"
    public var heads:[StyleJudgeHead]
    public var note="Starter labels describe authored procedural recipes. Holdout uses unseen seeds of the same recipes, not independent historical/design-style ground truth. Reviewed source labels add real examples; unknown styles are excluded from those labels. Style scores are uncalibrated classifier outputs, not probabilities of art-historical attribution."
}

public enum StyleJudgeTrainer {
    private struct Row {var vector:[Double];var category:String?;var labels:[String:String];var test:Bool;var reviewed:Bool}
    public static func train(directory:URL,seeds:Int=32,records:[PosterRecord]=[],progress:@Sendable(String)->Void={_ in})throws->StyleJudgeTraining {
        guard (12...200).contains(seeds) else{throw PosterError.invalid("Style training uses 12–200 seeds per recipe.")}
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let embedder=LibraryVisualEmbedder()
        var rows:[Row]=[]
        let columns=(0..<64).map{"f\($0)"}
        for category in StyleCatalog.categories {
            for i in 0..<seeds {
                try Task.checkCancellation()
                let seed=UInt64(i+1)*7919
                let image=try StylePosterRenderer.render(style:category.id,seed:seed,width:480)
                rows.append(Row(vector:try TechniqueTrainer.project(embedder.embed(image)),category:category.id,labels:[:],test:i%5==0,reviewed:false))
            }
            progress("Embedded \(seeds) \(category.name) recipe examples")
        }
        let reviewed=records.filter{!($0.styleLabels ?? [:]).isEmpty}
        var parent=Array(reviewed.indices)
        func root(_ i:Int)->Int {var k=i;while parent[k] != k{k=parent[k]};return k}
        for i in reviewed.indices {for j in reviewed.indices where j<i {
            if try reviewed[i].source.postID==reviewed[j].source.postID || reviewed[i].embedding.distance(to:reviewed[j].embedding)<0.14 {
                let a=root(i),b=root(j);parent[max(a,b)]=min(a,b)
            }
        }}
        for i in reviewed.indices {
            let record=reviewed[i],hash=LibraryRaster.hash(Data(reviewed[root(i)].source.postID.utf8))
            let test=(UInt64(hash.prefix(8),radix:16) ?? 0)%5==0
            rows.append(Row(vector:try TechniqueTrainer.project(record.embedding),category:nil,labels:record.styleLabels ?? [:],test:test,reviewed:true))
        }
        var heads:[StyleJudgeHead]=[]
        for category in StyleCatalog.categories {
            func label(_ row:Row)->String? {row.reviewed ? row.labels[category.id].flatMap{["present","absent"].contains($0) ? $0:nil}:row.category==category.id ? "present":"absent"}
            let labeled=rows.compactMap{row in label(row).map{(row,$0)}}
            let train=labeled.filter{!$0.0.test},test=labeled.filter{$0.0.test}
            // Dataset rows remain auditable, including seed/source holdout and label origin.
            let csv=directory.appending(path:category.id+"-training.csv")
            try ([ (columns+["label"]).joined(separator:",") ]+train.map{($0.0.vector.map(String.init(describing:))+[$0.1]).joined(separator:",")}).joined(separator:"\n").write(to:csv,atomically:true,encoding:.utf8)
            let frame=try DataFrame(contentsOfCSVFile:csv)
            let params=MLLogisticRegressionClassifier.ModelParameters(validation:.none,maxIterations:100,l2Penalty:0.5,featureRescaling:true)
            let classifier=try MLLogisticRegressionClassifier(trainingData:frame,targetColumn:"label",featureColumns:columns,parameters:params)
            let filename=category.id+".mlmodel";try classifier.write(to:directory.appending(path:filename))
            var correct=0,reviewedCorrect=0,reviewedCount=0
            for (row,truth) in test {
                let input=try MLDictionaryFeatureProvider(dictionary:Dictionary(uniqueKeysWithValues:zip(columns,row.vector).map{($0,MLFeatureValue(double:$1))}))
                let predicted=try classifier.model.prediction(from:input).featureValue(for:"label")?.stringValue
                if predicted==truth{correct+=1};if row.reviewed{reviewedCount+=1;if predicted==truth{reviewedCorrect+=1}}
            }
            heads.append(StyleJudgeHead(category:category.id,name:category.name,modelFile:filename,trainingRows:train.count,holdoutRows:test.count,accuracy:Double(correct)/Double(max(1,test.count)),reviewedTrainingRows:train.filter{$0.0.reviewed}.count,reviewedHoldoutRows:reviewedCount,reviewedAccuracy:reviewedCount>0 ? Double(reviewedCorrect)/Double(reviewedCount):nil))
            progress("Trained \(category.name): \(train.count) training, \(test.count) holdout rows")
        }
        let result=StyleJudgeTraining(heads:heads)
        try LibraryRaster.write(result,to:directory.appending(path:"training.json"))
        return result
    }
}

/// Confined to its owning evolution actor.
final class StyleJudgeBank {
    private var heads:[(String,MLModel,String)]=[]
    private let embedder=LibraryVisualEmbedder()
    private var designerReferences:[DesignerJudgeProfile]=[]
    let note:String
    init(directory:URL?=nil,cpuOnly:Bool=false)throws {
        let config=MLModelConfiguration();config.computeUnits=cpuOnly ? .cpuOnly:.all
        var notes:[String]=[]
        if let directory=directory ?? StyleCatalog.bundledDirectory,FileManager.default.fileExists(atPath:directory.appending(path:"training.json").path) {
            let manifest=try JSONDecoder().decode(StyleJudgeTraining.self,from:Data(contentsOf:directory.appending(path:"training.json")))
            guard manifest.version=="style-judges-v1",manifest.projection=="vision-r2-scaleFit-signed-bucket-64-l2-v1" else{throw PosterError.invalid("Unsupported style judge schema.")}
            for head in manifest.heads {
                guard head.modelFile==head.category+".mlmodel",StyleCatalog.categories.contains(where:{$0.id==head.category && $0.name==head.name}) else{throw PosterError.invalid("Invalid style head manifest.")}
                let compiled=try MLModel.compileModel(at:directory.appending(path:head.modelFile))
                heads.append((head.name,try MLModel(contentsOf:compiled,configuration:config),"vision64"))
            }
            notes.append(manifest.note)
        }
        if let directory=DesignerCatalog.directory,let data=try? Data(contentsOf:directory.appending(path:"training.json")) {
            let manifest=try JSONDecoder().decode(DesignerTraining.self,from:data)
            guard ["real-designer-affinity-v1","real-designer-affinity-v2"].contains(manifest.version),["vision-r2-scaleFit-signed-bucket-64-l2-v1","vision-r2-full-or-projected-plus-color52-v1"].contains(manifest.features) else{throw PosterError.invalid("Unsupported designer head schema.")}
            for profile in manifest.profiles {
                if let file=profile.modelFile,profile.usableForVoting {
                    guard file==profile.id+".mlmodel",!file.contains("/") else{throw PosterError.invalid("Invalid designer head path.")}
                    heads.append((profile.judgeName,try MLModel(contentsOf:MLModel.compileModel(at:directory.appending(path:file)),configuration:config),profile.featureKind ?? "vision64"))
                }else{designerReferences.append(profile)}
            }
            notes.append(manifest.note)
        }
        note=notes.isEmpty ? "Style judges unavailable; train models first.":notes.joined(separator:" ")
    }
    func scores(_ image:CGImage)throws->[String:Double] {
        guard !heads.isEmpty || !designerReferences.isEmpty else{return [:]}
        return try scores(embedder.embed(image),colors:PosterColorAnalyzer().analyze(image))
    }
    func scores(_ embedding:VisualEmbedding,colors:PosterColorProfile?=nil)throws->[String:Double] {
        guard !heads.isEmpty || !designerReferences.isEmpty else{return [:]}
        let vector=try TechniqueTrainer.project(embedding)
        var inputs:[String:MLDictionaryFeatureProvider]=[:],scores:[String:Double]=[:]
        for (name,model,kind) in heads {
            if inputs[kind]==nil {
                let features=try DesignerFeatures.vector(embedding,colors:colors,kind:kind)
                inputs[kind]=try MLDictionaryFeatureProvider(dictionary:Dictionary(uniqueKeysWithValues:features.enumerated().map{("f\($0.offset)",MLFeatureValue(double:$0.element))}))
            }
            let result=try model.prediction(from:inputs[kind]!)
            guard let score=result.featureValue(for:"labelProbability")?.dictionaryValue[AnyHashable("present")]?.doubleValue,score.isFinite else{throw PosterError.invalid("Style judge returned an invalid score.")}
            scores[name]=min(1,max(0,score))
        }
        for profile in designerReferences where profile.centroid.count==vector.count {
            let distance=sqrt(zip(vector,profile.centroid).reduce(0.0){$0+pow($1.0-$1.1,2)})
            scores[profile.judgeName]=exp(-distance*2)
        }
        return scores
    }
}
