import Foundation
import CreateML
import CoreML
import TabularData

public struct TrainedTechnique: Codable, Sendable {
    public var scope:String;public var tag:String;public var modelURL:URL?
    public var trainingRows:Int;public var testRows:Int;public var positiveTraining:Int
    public var precision:Double?;public var recall:Double?;public var accuracy:Double?
    public var note:String
}
public struct TechniqueTrainingRun: Codable, Sendable {
    public var version="visual-technique-heads-v1"
    public var labelMode:String
    public var embeddingModel:String
    public var preprocessing:String
    public var projection="signed-bucket-64-l2-v1"
    public var split="Instagram post groups plus near-duplicate poster clusters; deterministic 80/20 holdout"
    public var results:[TrainedTechnique]
    public var note="Bootstrap labels are detector-derived, not visual ground truth. Holdout metrics measure agreement with those labels. Unknown techniques are excluded; no unseen tag is treated as absent. Review and retrain before relying on style/technique recognition."
}

public enum TechniqueTrainer {
    public static func project(_ embedding:VisualEmbedding)throws->[Double] {
        let values=try embedding.values();var result=[Double](repeating:0,count:64)
        for (i,value) in values.enumerated(){let sign=((i &* 1103515245 &+ 12345)>>8)&1 == 0 ? 1.0 : -1.0;result[i%64]+=Double(value)*sign}
        let norm=sqrt(result.reduce(0){$0+$1*$1});return norm>0 ? result.map{$0/norm}:result
    }
    private struct Row {var vector:[Double];var group:String;var tags:[TechniqueTag];var stats:VisualStatistics;var lines:Int;var rotated:Bool}
    public static func train(records:[PosterRecord],directory:URL,bootstrap:Bool,progress:@Sendable(String)->Void={_ in})throws->TechniqueTrainingRun {
        guard let first=records.first else{throw PosterError.invalid("No indexed posters available.")}
        let run=directory.appending(path:"models/run-\(UUID().uuidString.prefix(8))")
        try FileManager.default.createDirectory(at:run,withIntermediateDirectories:true)
        // Merge visual near-duplicates and source post groups before partitioning; crops never cross their poster group.
        var parent=Array(records.indices)
        func root(_ i:Int)->Int {var k=i;while parent[k] != k{k=parent[k]};return k}
        for i in records.indices {for j in records.indices where j<i {
            let nearDuplicate=try records[i].embedding.distance(to:records[j].embedding)<0.14
            if records[i].source.postID==records[j].source.postID || nearDuplicate {
                let a=root(i),b=root(j);parent[max(a,b)]=min(a,b)
            }
        }}
        var posterRows:[Row]=[],elementRows:[Row]=[]
        for i in records.indices {
            let record=records[i],group=records[root(i)].id
            posterRows.append(Row(vector:try project(record.embedding),group:group,tags:record.tags,stats:record.statistics,
                lines:record.elements.filter{$0.kind=="text-line"}.count,rotated:record.elements.contains{$0.kind=="text-line" && abs($0.rotation)>12}))
            for element in record.elements.filter({$0.reviewStatus != "rejected"}).prefix(64) {
                elementRows.append(Row(vector:try project(element.embedding),group:group,tags:element.tags,stats:element.statistics,lines:element.kind=="text-line" ? 1:0,rotated:abs(element.rotation)>12))
            }
        }
        func label(_ row:Row,_ tag:String)->String? {
            if let reviewed=row.tags.first(where:{$0.name==tag && $0.origin=="review"}) {return reviewed.state=="rejected" ? "absent":"present"}
            guard bootstrap else{return nil}
            // Only these measurable operational definitions have detector-derived negatives.
            switch tag {
            case "monochrome":return row.stats.saturation<0.055 ? "present":"absent"
            case "high-contrast":return row.stats.contrast>0.31 ? "present":"absent"
            case "dense-typography":return row.lines>18 ? "present":"absent"
            case "rotation":return row.rotated ? "present":"absent"
            default:return nil
            }
        }
        func isTest(_ group:String)->Bool {let hash=LibraryRaster.hash(Data(group.utf8));return (UInt64(hash.prefix(8),radix:16) ?? 0)%5==0}
        let columns=(0..<64).map{"f\($0)"}
        var results:[TrainedTechnique]=[]
        for (scope,rows) in [("poster",posterRows),("element",elementRows)] {
            for tag in TechniqueTaxonomy.names {
                try Task.checkCancellation()
                let labeled=rows.compactMap{row -> (Row,String)? in label(row,tag).map{(row,$0)}}
                let training=labeled.filter{!isTest($0.0.group)},test=labeled.filter{isTest($0.0.group)}
                let positive=training.filter{$0.1=="present"}.count,negative=training.count-positive
                guard positive>=4,negative>=4,test.contains(where:{$0.1=="present"}),test.contains(where:{$0.1=="absent"}) else {
                    results.append(TrainedTechnique(scope:scope,tag:tag,modelURL:nil,trainingRows:training.count,testRows:test.count,positiveTraining:positive,precision:nil,recall:nil,accuracy:nil,
                        note:"Skipped: need at least four positive and four negative training rows plus both classes in independent holdout groups. Unknown labels remain unknown."));continue
                }
                let csv=run.appending(path:"\(scope)-\(tag)-training.csv")
                let header=(columns+["label"]).joined(separator:",")
                let lines=training.map{($0.0.vector.map(String.init(describing:))+[$0.1]).joined(separator:",")}
                try ([header]+lines).joined(separator:"\n").write(to:csv,atomically:true,encoding:.utf8)
                let frame=try DataFrame(contentsOfCSVFile:csv)
                let parameters=MLLogisticRegressionClassifier.ModelParameters(validation:.none,maxIterations:80,l2Penalty:1,featureRescaling:true)
                let model=try MLLogisticRegressionClassifier(trainingData:frame,targetColumn:"label",featureColumns:columns,parameters:parameters)
                let url=run.appending(path:"\(scope)-\(tag).mlmodel");try model.write(to:url)
                var tp=0,fp=0,tn=0,fn=0
                for (row,truth) in test {
                    let dictionary=Dictionary(uniqueKeysWithValues:zip(columns,row.vector).map{($0,MLFeatureValue(double:$1))})
                    let prediction=try model.model.prediction(from:MLDictionaryFeatureProvider(dictionary:dictionary))
                    let predicted=prediction.featureValue(for:"label")?.stringValue=="present"
                    if truth=="present" {if predicted{tp+=1}else{fn+=1}}else{if predicted{fp+=1}else{tn+=1}}
                }
                results.append(TrainedTechnique(scope:scope,tag:tag,modelURL:url,trainingRows:training.count,testRows:test.count,positiveTraining:positive,
                    precision:Double(tp)/Double(max(1,tp+fp)),recall:Double(tp)/Double(max(1,tp+fn)),accuracy:Double(tp+tn)/Double(max(1,test.count)),
                    note:bootstrap ? "Experimental weak-label classifier; not validated against human technique annotations.":"Classifier trained on reviewed positive/negative annotations."))
                progress("Trained \(scope)/\(tag): \(training.count) rows, \(test.count) grouped holdout rows")
            }
        }
        let result=TechniqueTrainingRun(labelMode:bootstrap ? "bootstrap-weak-measurement-labels":"reviewed-labels-only",embeddingModel:first.embedding.model,preprocessing:first.embedding.preprocessing,results:results)
        try LibraryRaster.write(result,to:run.appending(path:"training.json"))
        try LibraryRaster.write(result,to:directory.appending(path:"training.json"))
        return result
    }
    public static func predict(imageURL:URL,training:TechniqueTrainingRun,scope:String)throws->[TechniqueTag] {
        guard ["poster","element"].contains(scope) else{throw PosterError.invalid("Model scope must be poster or element.")}
        let embedding=try LibraryRaster.embedding(LibraryRaster.oriented(imageURL))
        guard embedding.model==training.embeddingModel,embedding.preprocessing==training.preprocessing else{throw PosterError.invalid("Technique model embedding schema mismatch.")}
        let vector=try project(embedding)
        let input=try MLDictionaryFeatureProvider(dictionary:Dictionary(uniqueKeysWithValues:vector.enumerated().map{("f\($0.offset)",MLFeatureValue(double:$0.element))}))
        var tags:[TechniqueTag]=[]
        for head in training.results where head.scope==scope {
            guard let url=head.modelURL else{continue}
            let configuration=MLModelConfiguration();configuration.computeUnits = .all
            let model=try MLModel(contentsOf:MLModel.compileModel(at:url),configuration:configuration)
            let result=try model.prediction(from:input)
            let probabilities=result.featureValue(for:"labelProbability")?.dictionaryValue
            let probability=probabilities?[AnyHashable("present")]?.doubleValue ?? (result.featureValue(for:"label")?.stringValue=="present" ? 1:0)
            tags.append(TechniqueTag(head.tag,confidence:probability,evidence:["Core ML \(head.scope) head, label mode \(training.labelMode). Holdout agreement: \(head.accuracy ?? 0)."],origin:"model"))
        }
        return tags.sorted{$0.confidence>$1.confidence}
    }
}
