import Foundation
import CoreGraphics
import CoreML
import CreateML
import TabularData
import Darwin

public struct TasteAsset:Codable,Identifiable,Sendable {
    public var id:String;public var imageURL:URL;public var sourceImageURL:URL
    public var candidateID:String;public var study:String;public var category:String;public var title:String;public var groupID:String
    public var embedding:VisualEmbedding;public var features:[Double]
    public init(id:String,imageURL:URL,sourceImageURL:URL,candidateID:String,study:String,category:String,title:String,groupID:String,embedding:VisualEmbedding,features:[Double]){self.id=id;self.imageURL=imageURL;self.sourceImageURL=sourceImageURL;self.candidateID=candidateID;self.study=study;self.category=category;self.title=title;self.groupID=groupID;self.embedding=embedding;self.features=features}
}
public struct TasteVote:Codable,Sendable {public var yes:Bool;public var date:Date;public var origin:String}
public struct TasteVoteEvent:Codable,Sendable {public var assetID:String;public var previous:TasteVote?;public var date:Date}
public struct TasteTraining:Codable,Sendable {
    public var featureSchema="vision-r2-scaleFit-signed-bucket-64-l2-v1"
    public var modelURL:URL;public var modelSHA256:String? = nil;public var labelsDigest:String;public var date:Date
    public var positive:Int;public var negative:Int;public var trainingRows:Int;public var holdoutRows:Int;public var balancedAccuracy:Double?
    public var note="Personal preference classifier. Only explicit yes/no votes are labels. Scores are uncalibrated affinity, not aesthetic quality. Evaluation, when available, holds source-layout groups apart; the final model then uses all votes."
}
public struct TasteProfile:Codable,Identifiable,Sendable {
    public var id:String;public var name:String;public var enabled=true;public var weight=1.0
    public var votes:[String:TasteVote]=[:];public var events:[TasteVoteEvent]=[];public var training:TasteTraining?;public var lastError:String?
    public var positive:Int{votes.values.filter(\.yes).count};public var negative:Int{votes.count-positive}
    public var judgeName:String{"Taste / "+name}
    public var digest:String{LibraryRaster.hash(Data(votes.keys.sorted().map{"\($0):\(votes[$0]!.yes ? "yes":"no")\n"}.joined().utf8))}
    public var ready:Bool{positive>=3 && negative>=3 && training?.labelsDigest==digest && FileManager.default.fileExists(atPath:training?.modelURL.path ?? "")}
    public init(id:String=UUID().uuidString,name:String){self.id=id;self.name=name}
}
public struct TasteArchive:Codable,Sendable {
    public var version=1;public var assets:[TasteAsset]=[];public var profiles:[TasteProfile]=[];public var seededFavourites=false
    public init(){}
}
public struct TasteJuryMember:Codable,Sendable {
    public var profileID:String;public var name:String;public var weight:Double;public var training:TasteTraining
}

/// Explicit votes are the only taste labels. The shared lock also protects CLI/UI writers.
public actor TasteStore {
    public let directory:URL
    public init(directory:URL){self.directory=directory.standardizedFileURL}
    private var archiveURL:URL{directory.appending(path:"taste.json")}
    private func exclusive<T>(_ body:()throws->T)throws->T {
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let fd=Darwin.open(directory.appending(path:".writer.lock").path,O_CREAT|O_RDWR,0o600)
        guard fd>=0 else{throw PosterError.invalid("Cannot lock the taste archive.")};defer{Darwin.close(fd)}
        guard flock(fd,LOCK_EX)==0 else{throw PosterError.invalid("Taste archive is busy.")};defer{flock(fd,LOCK_UN)}
        return try body()
    }
    private func read()throws->TasteArchive {
        guard FileManager.default.fileExists(atPath:archiveURL.path) else{return TasteArchive()}
        let archive=try JSONDecoder().decode(TasteArchive.self,from:Data(contentsOf:archiveURL))
        guard archive.version==1 else{throw PosterError.invalid("Unsupported taste archive.")};return archive
    }
    public func load()throws->TasteArchive{try read()}
    private func write(_ archive:TasteArchive)throws{try LibraryRaster.write(archive,to:archiveURL)}
    @discardableResult public func prepare(outputRoot:URL,seedFavourites:Bool=false,progress:@Sendable(String)->Void={_ in})throws->TasteArchive {
        try exclusive {
            var archive=try read(),known=Set(archive.assets.map(\.id))
            let runs=(try FileManager.default.contentsOfDirectory(at:outputRoot,includingPropertiesForKeys:nil)).filter{$0.lastPathComponent.hasPrefix("source-")}.sorted{$0.lastPathComponent<$1.lastPathComponent}
            let snapshots=directory.appending(path:"assets");try FileManager.default.createDirectory(at:snapshots,withIntermediateDirectories:true)
            for run in runs {
                guard let enumerator=FileManager.default.enumerator(at:run,includingPropertiesForKeys:nil,options:[.skipsHiddenFiles]) else{continue}
                let files=enumerator.compactMap{$0 as? URL}.filter{$0.lastPathComponent=="round.json"}.sorted{$0.path<$1.path}
                for file in files {
                    try Task.checkCancellation()
                    guard let data=try? Data(contentsOf:file),let round=try? JSONDecoder().decode(HybridRound.self,from:data) else{continue}
                    for scene in round.candidates where scene.genome.contentBrief != nil {
                        guard let png=try? Data(contentsOf:scene.imageURL) else{continue}
                        let id=LibraryRaster.hash(png);guard !known.contains(id) else{continue}
                        let embeddingURL=file.deletingLastPathComponent().appending(path:scene.id+"-embedding.json")
                        guard let data=try? Data(contentsOf:embeddingURL),let embedding=try? JSONDecoder().decode(VisualEmbedding.self,from:data),embedding.revision==2,embedding.dimensions==768 else{continue}
                        let features=try TasteTrainer.features(embedding),snapshot=snapshots.appending(path:id+".png")
                        if !FileManager.default.fileExists(atPath:snapshot.path){try png.write(to:snapshot,options:.atomic)}
                        archive.assets.append(TasteAsset(id:id,imageURL:snapshot,sourceImageURL:scene.imageURL,candidateID:scene.id,study:run.lastPathComponent,category:scene.genome.styleCategory ?? round.direction,title:scene.genome.posterCopy?.title.replacingOccurrences(of:"\n",with:" ") ?? scene.id,groupID:scene.genome.layoutInheritance?.skeletonPosterID ?? run.lastPathComponent+"/"+round.direction,embedding:embedding,features:features));known.insert(id)
                    }
                }
                progress("Taste deck: \(archive.assets.count) unique concept posters")
            }
            if archive.profiles.isEmpty{archive.profiles=[TasteProfile(id:"personal",name:"Personal taste")]}
            if seedFavourites && !archive.seededFavourites {
                let ids:Set<String>=["optical-r0-c6","color-field-r2-c4","guilloche-r0-c6"]
                for asset in archive.assets where asset.study=="source-compositions-v13" && ids.contains(asset.candidateID) {
                    if archive.profiles[0].votes[asset.id]==nil{archive.profiles[0].votes[asset.id]=TasteVote(yes:true,date:Date(),origin:"user-request-three-favourites")}
                }
                archive.seededFavourites=true
            }
            try write(archive);return archive
        }
    }
    /// Include a selected generated output even when it is custom copy or a retained elite.
    public func include(imageURL:URL)throws->TasteAsset {
        try exclusive {
            guard imageURL.isFileURL else{throw PosterError.invalid("Taste votes use local generated images.")}
            var archive=try read();let png=try Data(contentsOf:imageURL),id=LibraryRaster.hash(png)
            if let existing=archive.assets.first(where:{$0.id==id}){return existing}
            let folder=imageURL.deletingLastPathComponent(),round=(try? Data(contentsOf:folder.appending(path:"round.json"))).flatMap{try? JSONDecoder().decode(HybridRound.self,from:$0)}
            let scene=round?.candidates.first{$0.imageURL.standardizedFileURL==imageURL.standardizedFileURL}
            let name=imageURL.deletingPathExtension().lastPathComponent
            let saved=(try? Data(contentsOf:folder.appending(path:name+"-embedding.json"))).flatMap{try? JSONDecoder().decode(VisualEmbedding.self,from:$0)}
            let embedding=try saved ?? LibraryRaster.embedding(LibraryRaster.oriented(imageURL)),features=try TasteTrainer.features(embedding)
            let snapshot=directory.appending(path:"assets/"+id+".png");try FileManager.default.createDirectory(at:snapshot.deletingLastPathComponent(),withIntermediateDirectories:true)
            try png.write(to:snapshot,options:.atomic)
            let asset=TasteAsset(id:id,imageURL:snapshot,sourceImageURL:imageURL,candidateID:scene?.id ?? name,study:folder.deletingLastPathComponent().deletingLastPathComponent().lastPathComponent,category:scene?.genome.styleCategory ?? "custom",title:scene?.genome.posterCopy?.title.replacingOccurrences(of:"\n",with:" ") ?? name,groupID:scene?.genome.layoutInheritance?.skeletonPosterID ?? id,embedding:embedding,features:features)
            archive.assets.append(asset);try write(archive);return asset
        }
    }
    public func next(profileID:String,skipped:Set<String>)throws->TasteAsset? {
        let archive=try read();guard let profile=archive.profiles.first(where:{$0.id==profileID}) else{return nil}
        var scores:[String:Double]=[:]
        if profile.ready {
            let bank=try TasteJudgeBank(directory:directory)
            for asset in archive.assets where profile.votes[asset.id]==nil && !skipped.contains(asset.id){scores[asset.id]=try bank.scores(features:asset.features)[profile.judgeName]}
        }
        return TasteTrainer.next(assets:archive.assets,profile:profile,skipped:skipped,scores:scores)
    }
    public func createProfile(name:String)throws->TasteProfile {
        try exclusive{var archive=try read();let clean=try checkedName(name,archive:archive);let p=TasteProfile(name:clean);archive.profiles.append(p);try write(archive);return p}
    }
    private func checkedName(_ name:String,archive:TasteArchive,except:String?=nil)throws->String {
        let clean=name.trimmingCharacters(in:.whitespacesAndNewlines)
        guard !clean.isEmpty,clean.count<=48,!clean.contains("/"),!clean.unicodeScalars.contains(where:{CharacterSet.controlCharacters.contains($0)}),!archive.profiles.contains(where:{$0.id != except && $0.name.localizedCaseInsensitiveCompare(clean) == .orderedSame}) else{throw PosterError.invalid("Choose a unique profile name of 1–48 characters, without slashes.")};return clean
    }
    public func configure(profileID:String,name:String?=nil,enabled:Bool?=nil,weight:Double?=nil)throws {
        try exclusive{var archive=try read();guard let i=archive.profiles.firstIndex(where:{$0.id==profileID}) else{throw PosterError.invalid("Taste profile is missing.")}
            if let name{archive.profiles[i].name=try checkedName(name,archive:archive,except:profileID)}
            if let enabled{archive.profiles[i].enabled=enabled}
            if let weight{guard weight.isFinite,(0...3).contains(weight) else{throw PosterError.invalid("Taste weight must be 0–3.")};archive.profiles[i].weight=weight}
            try write(archive)
        }
    }
    public func vote(profileID:String,assetID:String,yes:Bool?)throws {
        try exclusive{var archive=try read();guard archive.assets.contains(where:{$0.id==assetID}),let i=archive.profiles.firstIndex(where:{$0.id==profileID}) else{throw PosterError.invalid("Unknown poster or taste profile.")}
            let previous=archive.profiles[i].votes[assetID]
            archive.profiles[i].events.append(TasteVoteEvent(assetID:assetID,previous:previous,date:Date()))
            archive.profiles[i].votes[assetID]=yes.map{TasteVote(yes:$0,date:Date(),origin:"user-vote")};archive.profiles[i].lastError=nil
            try write(archive)
        }
    }
    @discardableResult public func undo(profileID:String)throws->String? {
        try exclusive{var archive=try read();guard let i=archive.profiles.firstIndex(where:{$0.id==profileID}),let event=archive.profiles[i].events.popLast() else{return nil}
            archive.profiles[i].votes[event.assetID]=event.previous;archive.profiles[i].lastError=nil;try write(archive);return event.assetID}
    }
    @discardableResult public func train(profileID:String)throws->TasteProfile {
        let archive=try read();guard let profile=archive.profiles.first(where:{$0.id==profileID}) else{throw PosterError.invalid("Taste profile is missing.")}
        guard profile.positive>=3,profile.negative>=3 else{return profile}
        if profile.ready{return profile}
        let training=try TasteTrainer.train(profile,assets:archive.assets,directory:directory.appending(path:"models/"+profile.id+"/"+profile.digest+"-"+UUID().uuidString.prefix(8)))
        return try exclusive{var latest=try read();guard let i=latest.profiles.firstIndex(where:{$0.id==profileID}),latest.profiles[i].digest==profile.digest else{throw PosterError.invalid("Votes changed during training. The next vote will retrain this profile.")};latest.profiles[i].training=training;latest.profiles[i].lastError=nil;try write(latest);return latest.profiles[i]}
    }
}

public enum TasteTrainer {
    public static func features(_ embedding:VisualEmbedding)throws->[Double] {
        guard embedding.model=="Apple-Vision-image-feature-print",embedding.revision==2,embedding.dimensions==768,embedding.preprocessing=="upright-sRGB-vision-scaleFit-v1",try embedding.values().allSatisfy(\.isFinite) else{throw PosterError.invalid("Taste needs Vision revision-2 scaleFit feature prints.")}
        let vector=try TechniqueTrainer.project(embedding);guard vector.allSatisfy(\.isFinite),vector.contains(where:{abs($0)>0}) else{throw PosterError.invalid("Empty taste features.")};return vector
    }
    public static func isJudge(_ key:String)->Bool{key.hasPrefix("Taste / ") && key.count<=60}
    public static func train(_ profile:TasteProfile,assets:[TasteAsset],directory:URL)throws->TasteTraining {
        let rows=assets.compactMap{asset in profile.votes[asset.id].map{(asset,$0.yes)}}
        guard rows.filter({$0.1}).count>=3,rows.filter({!$0.1}).count>=3,rows.count==profile.votes.count,rows.allSatisfy({$0.0.features.count==64 && $0.0.features.allSatisfy(\.isFinite)}) else{throw PosterError.invalid("Taste training needs at least three yes and three no votes with matching feature vectors.")}
        for (asset,_) in rows{let vector=try features(asset.embedding);guard zip(vector,asset.features).allSatisfy({abs($0-$1)<1e-12}) else{throw PosterError.invalid("Taste features changed from their frozen embedding.")}}
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let columns=(0..<64).map{"f\($0)"}
        func fit(_ examples:[(TasteAsset,Bool)],stem:String)throws->MLLogisticRegressionClassifier {
            let positive=examples.filter{$0.1},negative=examples.filter{!$0.1},count=max(positive.count,negative.count)
            // Balance classes by repetition of explicit rows, never by invented votes.
            let balanced=(0..<count).flatMap{i in [positive[i%positive.count],negative[i%negative.count]]}
            let csv=directory.appending(path:stem+".csv")
            try ([ (columns+["label"]).joined(separator:",") ]+balanced.map{($0.0.features.map(String.init(describing:))+[$0.1 ? "yes":"no"]).joined(separator:",")}).joined(separator:"\n").write(to:csv,atomically:true,encoding:.utf8)
            let parameters=MLLogisticRegressionClassifier.ModelParameters(validation:.none,maxIterations:100,l2Penalty:2,featureRescaling:false)
            return try MLLogisticRegressionClassifier(trainingData:DataFrame(contentsOfCSVFile:csv),targetColumn:"label",featureColumns:columns,parameters:parameters)
        }
        let holdout=rows.filter{(UInt64(LibraryRaster.hash(Data($0.0.groupID.utf8)).prefix(8),radix:16) ?? 0)%5==0}
        let heldIDs=Set(holdout.map{$0.0.id}),learning=rows.filter{!heldIDs.contains($0.0.id)}
        var agreement:Double?,heldCount=0
        if rows.count>=30,holdout.filter({$0.1}).count>=3,holdout.filter({!$0.1}).count>=3,learning.filter({$0.1}).count>=3,learning.filter({!$0.1}).count>=3 {
            let evaluation=try fit(learning,stem:"evaluation-training");var tp=0,tn=0,positive=0,negative=0
            for (asset,yes) in holdout {let predicted=try prediction(evaluation.model,features:asset.features)>=0.5;if yes{positive+=1;if predicted{tp+=1}}else{negative+=1;if !predicted{tn+=1}}}
            agreement=(Double(tp)/Double(positive)+Double(tn)/Double(negative))/2;heldCount=holdout.count
        }
        let classifier=try fit(rows,stem:"training"),url=directory.appending(path:"taste.mlmodel");try classifier.write(to:url)
        let result=TasteTraining(modelURL:url,modelSHA256:try LibraryRaster.hash(Data(contentsOf:url)),labelsDigest:profile.digest,date:Date(),positive:profile.positive,negative:profile.negative,trainingRows:rows.count,holdoutRows:heldCount,balancedAccuracy:agreement)
        try LibraryRaster.write(result,to:directory.appending(path:"training.json"));return result
    }
    static func prediction(_ model:MLModel,features:[Double])throws->Double {
        guard features.count==64,features.allSatisfy(\.isFinite) else{throw PosterError.invalid("Taste feature schema mismatch.")}
        let input=try MLDictionaryFeatureProvider(dictionary:Dictionary(uniqueKeysWithValues:features.enumerated().map{("f\($0.offset)",MLFeatureValue(double:$0.element))}))
        let prediction=try model.prediction(from:input)
        guard let score=prediction.featureValue(for:"labelProbability")?.dictionaryValue[AnyHashable("yes")]?.doubleValue,score.isFinite else{throw PosterError.invalid("Taste model returned no finite preference score.")};return min(1,max(0,score))
    }
    /// Mix uncertainty with distance from voted examples; unvoted posters never become negatives.
    public static func next(assets:[TasteAsset],profile:TasteProfile,skipped:Set<String>,scores:[String:Double]=[:])->TasteAsset? {
        let voted=assets.filter{profile.votes[$0.id] != nil},lastGroup=voted.last?.groupID
        let candidates=assets.filter{profile.votes[$0.id]==nil && !skipped.contains($0.id)}
        return candidates.max{a,b in
            func utility(_ asset:TasteAsset)->Double {
                let novelty=voted.map{other in sqrt(zip(asset.features,other.features).reduce(0.0){$0+pow($1.0-$1.1,2)})}.min() ?? 1
                let uncertainty=scores[asset.id].map{1-abs($0-0.5)*2} ?? 0.5
                let hash=UInt64(LibraryRaster.hash(Data((profile.id+asset.id+String(profile.votes.count)).utf8)).prefix(8),radix:16) ?? 0
                return min(1,novelty)*0.45+uncertainty*0.45+(asset.groupID==lastGroup ? 0:0.05)+Double(hash%1000)/1000*0.05
            }
            let aa=utility(a),bb=utility(b);return aa==bb ? a.id<b.id:aa<bb
        }
    }
}

/// Confined to its owning actor; model versions are frozen for a generation/study.
public final class TasteJudgeBank {
    private var heads:[(TasteProfile,MLModel)]=[]
    public let members:[TasteJuryMember]
    public var weights:[String:Double]{Dictionary(uniqueKeysWithValues:heads.map{($0.0.judgeName,$0.0.weight)})}
    public init(directory:URL?)throws {
        var members:[TasteJuryMember]=[]
        if let directory,let data=try? Data(contentsOf:directory.appending(path:"taste.json")) {
            let archive=try JSONDecoder().decode(TasteArchive.self,from:data),configuration=MLModelConfiguration();configuration.computeUnits = .all
            for profile in archive.profiles where profile.ready && profile.enabled && profile.weight.isFinite && profile.weight>0 && profile.weight<=3 {
                guard let training=profile.training,training.featureSchema=="vision-r2-scaleFit-signed-bucket-64-l2-v1" else{continue}
                if let checksum=training.modelSHA256{guard try LibraryRaster.hash(Data(contentsOf:training.modelURL))==checksum else{throw PosterError.invalid("The saved taste model changed. Retrain that profile before judging.")}}
                let compiled=try MLModel.compileModel(at:training.modelURL);defer{try? FileManager.default.removeItem(at:compiled)}
                heads.append((profile,try MLModel(contentsOf:compiled,configuration:configuration)))
                members.append(TasteJuryMember(profileID:profile.id,name:profile.name,weight:profile.weight,training:training))
            }
        }
        self.members=members
    }
    public func scores(_ embedding:VisualEmbedding)throws->[String:Double]{try scores(features:TasteTrainer.features(embedding))}
    public func scores(features:[Double])throws->[String:Double]{var result:[String:Double]=[:];for (profile,model) in heads{result[profile.judgeName]=try TasteTrainer.prediction(model,features:features)};return result}
    public func scores(_ image:CGImage)throws->[String:Double]{heads.isEmpty ? [:]:try scores(LibraryVisualEmbedder().embed(image))}
}
