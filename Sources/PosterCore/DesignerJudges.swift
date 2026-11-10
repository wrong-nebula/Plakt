import Foundation
import CreateML
import CoreML
import TabularData

public struct DesignerReference:Codable,Sendable {
    public var workID:String;public var title:String;public var creator:String;public var recordURL:String
    public var museum:String;public var date:String;public var imageRights:String
}
public struct DesignerJudgeProfile:Codable,Identifiable,Sendable {
    public var id:String;public var name:String;public var works:Int;public var uniqueGroups:Int
    public var modelFile:String?;public var trainingPositive:Int;public var trainingNegative:Int
    public var holdoutPositive:Int;public var holdoutNegative:Int
    public var precision:Double?;public var recall:Double?;public var balancedAccuracy:Double?
    public var centroid:[Double];public var references:[DesignerReference];public var note:String
    public var featureKind:String? = nil
    public var validationAUC:Double? = nil
    public var holdoutAUC:Double? = nil
    public var usableForVoting:Bool {modelFile != nil && (validationAUC.map{$0>=0.7} ?? ((balancedAccuracy ?? 0)>=0.65))}
    public var judgeName:String {"Designer / "+name}
}
public struct DesignerTraining:Codable,Sendable {
    public var version="real-designer-affinity-v2"
    public var features="vision-r2-full-or-projected-plus-color52-v1"
    public var profiles:[DesignerJudgeProfile]
    public var note="Labels come from credited real graphic works, not generated recipe images. These heads estimate visual affinity to sampled works, not artistic quality, designer authorship, endorsement, or comprehensive historical style. Identical images, near-duplicates and same-title series stay in one split group. Holdout is by work group; small references remain untrained similarity profiles. Artist-specific print/media and collection bias may remain."
}
public enum DesignerCatalog {
    public static var directory:URL? {PosterResources.bundle.url(forResource:"DesignerJudges",withExtension:nil,subdirectory:"Resources")}
    public static let profiles:[DesignerJudgeProfile]={
        guard let directory,let data=try? Data(contentsOf:directory.appending(path:"training.json")),let run=try? JSONDecoder().decode(DesignerTraining.self,from:data) else{return []}
        return run.profiles
    }()
}
public enum DesignerJudgeTrainer {
    private struct Dataset:Decodable {var version:String;var works:[Work]}
    private struct Work:Decodable {
        var designerID:String;var designer:String;var workID:String;var title:String;var creator:String
        var recordURL:String;var museum:String;var date:String;var imageRights:String;var localImagePath:String;var imageSHA256:String
    }
    private struct Row {var work:Work;var embedding:VisualEmbedding;var vector:[Double];var richer:[Double];var group:String}
    public static func train(datasetURL:URL,directory:URL,progress:@Sendable(String)->Void={_ in})throws->DesignerTraining {
        let dataset=try JSONDecoder().decode(Dataset.self,from:Data(contentsOf:datasetURL))
        guard dataset.version=="real-designer-works-v1",!dataset.works.isEmpty else{throw PosterError.invalid("No credited designer references in this dataset.")}
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let embedder=LibraryVisualEmbedder();var rows:[Row]=[]
        for (i,work) in dataset.works.enumerated() {
            let row=try autoreleasepool {()->Row in
                let image=try LibraryRaster.oriented(URL(fileURLWithPath:work.localImagePath))
                let embedding=try embedder.embed(image)
                let colors=try PosterColorAnalyzer().analyze(image)
                return Row(work:work,embedding:embedding,vector:try TechniqueTrainer.project(embedding),richer:try DesignerFeatures.vector(embedding,colors:colors,kind:"vision-color820"),group:work.workID)
            }
            rows.append(row)
            if i%25==0{progress("Embedded real work \(i+1)/\(dataset.works.count)")}
        }
        var parents=Array(rows.indices)
        func root(_ i:Int)->Int {var k=i;while parents[k] != k{k=parents[k]};return k}
        func normalized(_ s:String)->String {s.folding(options:[.diacriticInsensitive,.caseInsensitive],locale:Locale(identifier:"en_US_POSIX")).filter{$0.isLetter || $0.isNumber}}
        for i in rows.indices {for j in rows.indices where j<i {
            let a=rows[i].work,b=rows[j].work
            let identical=a.imageSHA256==b.imageSHA256 || a.workID==b.workID
            let generic=["concertposter","poster","untitled","design","letterhead"].contains(normalized(a.title))
            let series=a.designerID==b.designerID && normalized(a.title)==normalized(b.title) && (!generic || a.date==b.date)
            if try identical || series || rows[i].embedding.distance(to:rows[j].embedding)<0.12 {let x=root(i),y=root(j);parents[max(x,y)]=min(x,y)}
        }}
        for i in rows.indices{rows[i].group=rows[root(i)].work.workID}
        let ids=Array(Set(rows.map{$0.work.designerID})).sorted()
        func hash(_ s:String)->String{LibraryRaster.hash(Data(s.utf8))}
        var testGroups:Set<String>=[],validationGroups:Set<String>=[]
        for id in ids {
            let groups=Array(Set(rows.filter{$0.work.designerID==id}.map(\.group))).sorted{hash($0)<hash($1)}
            let n=max(2,groups.count/5)
            testGroups.formUnion(groups.prefix(n));validationGroups.formUnion(groups.dropFirst(n).prefix(n))
        }
        validationGroups.subtract(testGroups)
        var profiles:[DesignerJudgeProfile]=[]
        let audit=rows.map{["workID":$0.work.workID,"designerID":$0.work.designerID,"group":$0.group,"partition":testGroups.contains($0.group) ? "holdout":validationGroups.contains($0.group) ? "validation":"training","imageSHA256":$0.work.imageSHA256]}
        try LibraryRaster.write(audit,to:directory.appending(path:"split-audit.json"))
        for id in ids {
            let positive=rows.filter{$0.work.designerID==id},name=positive[0].work.designer
            let unique=Dictionary(grouping:positive,by:{$0.work.imageSHA256}).values.compactMap(\.first)
            var centroid=[Double](repeating:0,count:64)
            for row in unique{for i in 0..<64{centroid[i]+=row.vector[i]/Double(unique.count)}}
            let norm=sqrt(centroid.reduce(0){$0+$1*$1});if norm>0{centroid=centroid.map{$0/norm}}
            let trainPositive=positive.filter{!testGroups.contains($0.group) && !validationGroups.contains($0.group)}
            let validationPositive=positive.filter{validationGroups.contains($0.group)}
            let testPositive=positive.filter{testGroups.contains($0.group)}
            let negative=rows.filter{$0.work.designerID != id && !Set(positive.map(\.group)).contains($0.group)}
            let trainNegative=negative.filter{!testGroups.contains($0.group) && !validationGroups.contains($0.group)}
            let validationNegative=negative.filter{validationGroups.contains($0.group)}
            let testNegative=negative.filter{testGroups.contains($0.group)}
            let groups=Set(positive.map(\.group)).count
            var modelFile:String?,precision:Double?,recall:Double?,balanced:Double?
            var chosenKind="vision64",validationScore:Double?,holdoutScore:Double?
            var note="Reference-only visual centroid: insufficient independent works/groups for training, validation and holdout."
            if groups>=10,trainPositive.count>=8,validationPositive.count>=2,testPositive.count>=2,trainNegative.count>=16,validationNegative.count>=4,testNegative.count>=4 {
                func auc(_ positive:[Double],_ negative:[Double])->Double {
                    guard !positive.isEmpty,!negative.isEmpty else{return 0.5}
                    var correct=0.0
                    for a in positive{for b in negative{correct += a>b ? 1:abs(a-b)<1e-12 ? 0.5:0}}
                    return correct/Double(positive.count*negative.count)
                }
                func prediction(_ model:MLModel,_ row:Row,_ kind:String)throws->Double {
                    let vector=kind=="vision64" ? row.vector:row.richer
                    let input=try MLDictionaryFeatureProvider(dictionary:Dictionary(uniqueKeysWithValues:vector.enumerated().map{("f\($0.offset)",MLFeatureValue(double:$0.element))}))
                    return try model.prediction(from:input).featureValue(for:"labelProbability")?.dictionaryValue[AnyHashable("present")]?.doubleValue ?? 0
                }
                var bestModel:MLLogisticRegressionClassifier?,bestValidation = -Double.infinity
                for kind in ["vision64","vision-color820"] {
                    let training=trainPositive.map{($0,"present")}+trainNegative.map{($0,"absent")}
                    let dimensions=kind=="vision64" ? 64:820,columns=(0..<dimensions).map{"f\($0)"}
                    let csv=directory.appending(path:id+"-"+kind+"-training.csv")
                    try ([ (columns+["label"]).joined(separator:",") ]+training.map{ row,label in ((kind=="vision64" ? row.vector:row.richer).map(String.init(describing:))+[label]).joined(separator:",")}).joined(separator:"\n").write(to:csv,atomically:true,encoding:.utf8)
                    let frame=try DataFrame(contentsOfCSVFile:csv)
                    let params=MLLogisticRegressionClassifier.ModelParameters(validation:.none,maxIterations:120,l2Penalty:2,featureRescaling:true)
                    let model=try MLLogisticRegressionClassifier(trainingData:frame,targetColumn:"label",featureColumns:columns,parameters:params)
                    let values=try validationPositive.map{try prediction(model.model,$0,kind)},others=try validationNegative.map{try prediction(model.model,$0,kind)}
                    let score=auc(values,others)
                    if score>bestValidation {bestModel=model;bestValidation=score;chosenKind=kind}
                }
                let model=bestModel!,file=id+".mlmodel";try model.write(to:directory.appending(path:file));modelFile=file;validationScore=bestValidation
                let positives=try testPositive.map{try prediction(model.model,$0,chosenKind)},negatives=try testNegative.map{try prediction(model.model,$0,chosenKind)}
                holdoutScore=auc(positives,negatives)
                let tp=positives.filter{$0>=0.5}.count,fn=positives.count-tp,fp=negatives.filter{$0>=0.5}.count,tn=negatives.count-fp
                precision=Double(tp)/Double(max(1,tp+fp));recall=Double(tp)/Double(max(1,tp+fn));balanced=(Double(tp)/Double(max(1,tp+fn))+Double(tn)/Double(max(1,tn+fp)))/2
                note="Two feature sets compared using validation work groups; final metrics use untouched holdout groups. Affinity ranking is evaluated with ROC AUC. Half-probability precision/recall use an imbalanced author-membership task, not artistic quality. Heads below 0.70 validation AUC remain reference-only in voting."
            }
            let refs=positive.map{r in DesignerReference(workID:r.work.workID,title:r.work.title,creator:r.work.creator,recordURL:r.work.recordURL,museum:r.work.museum,date:r.work.date,imageRights:r.work.imageRights)}
            var profile=DesignerJudgeProfile(id:id,name:name,works:unique.count,uniqueGroups:groups,modelFile:modelFile,trainingPositive:trainPositive.count,trainingNegative:trainNegative.count,holdoutPositive:testPositive.count,holdoutNegative:testNegative.count,precision:precision,recall:recall,balancedAccuracy:balanced,centroid:centroid,references:refs,note:note)
            profile.featureKind=chosenKind;profile.validationAUC=validationScore;profile.holdoutAUC=holdoutScore;profiles.append(profile)
            progress("\(name): \(unique.count) real works · \(groups) groups · \(modelFile==nil ? "reference only":"trained")")
        }
        let result=DesignerTraining(profiles:profiles)
        try LibraryRaster.write(result,to:directory.appending(path:"training.json"))
        return result
    }
}

public enum DesignerFeatures {
    public static func vector(_ embedding:VisualEmbedding,colors:PosterColorProfile?,kind:String)throws->[Double] {
        if kind=="vision64"{return try TechniqueTrainer.project(embedding)}
        guard kind=="vision-color820" else{throw PosterError.invalid("Unsupported designer feature kind.")}
        var vector=try embedding.values().map(Double.init)
        guard vector.count==768 else{throw PosterError.invalid("Expected Vision revision-2 768-dimensional features.")}
        let norm=sqrt(vector.reduce(0){$0+$1*$1});if norm>0{vector=vector.map{$0/norm}}
        let color=colors?.colorEmbedding ?? Array(repeating:0,count:52)
        guard color.count==52 else{throw PosterError.invalid("Unsupported color embedding schema.")}
        return vector+color
    }
}
