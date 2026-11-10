import Foundation
import PosterCore

extension PosterChecks {
    static func checkJudgeMix()throws {
        let metrics=Measurements(coverage:0.5,detail:0.5,balance:0.5,contrast:0.5,readability:0.5,reference:0.5,hierarchy:0.5,repetition:0.5,recognizedWords:5)
        let a=Candidate(id:"a",genome:.random(seed:1),generation:0,imageURL:URL(fileURLWithPath:"/tmp/a.png"),measurements:metrics,scores:["Minimal":0.9,"Reference":0.1])
        let b=Candidate(id:"b",genome:.random(seed:2),generation:0,imageURL:URL(fileURLWithPath:"/tmp/b.png"),measurements:metrics,scores:["Minimal":0.1,"Reference":0.9])
        let minimal=Voting.rank([a,b],weights:["Minimal":3,"Reference":0.5])
        let reference=Voting.rank([a,b],weights:["Minimal":0.5,"Reference":3])
        try require(minimal.first?.id=="a" && reference.first?.id=="b","Changing style weights failed to change the winner")
        let zero=Voting.rank([a,b],weights:["Minimal":0,"Reference":1])
        try require(zero.first?.id=="b" && zero.allSatisfy{$0.votes["Minimal"]==nil},"Zero-weight judge cast a ballot")
        let scaled=Voting.rank([a,b],weights:["Minimal":6,"Reference":1])
        try require(abs((scaled.first?.consensus ?? 0)-(minimal.first?.consensus ?? 1))<1e-9,"Weight normalization depends on absolute scale")
        var settings=EvolutionSettings();settings.judgeWeights=["Minimal":0]
        try require(rejected{try settings.validate()},"All-zero judge mix accepted")
        settings.judgeWeights=["Imaginary":1]
        try require(rejected{try settings.validate()},"Unknown judge weight accepted")
        try require(DesignerCatalog.profiles.count==27,"Bundled real-designer profiles missing")
        try require(DesignerCatalog.profiles.filter(\.usableForVoting).count==18,"Unexpected validated designer head count")
        for profile in DesignerCatalog.profiles {
            let routing=StyleCatalog.generationWeights([profile.judgeName:3])
            try require(!routing.isEmpty && routing.keys.allSatisfy{key in StyleCatalog.categories.contains{$0.id==key}},"Designer preset has no valid generation route")
            try require(abs(routing.values.reduce(0,+)-3)<1e-9,"Designer routing changes total requested influence")
            try require(profile.references.count>0 && profile.references.allSatisfy{$0.recordURL.hasPrefix("https://www.moma.org/")},"Designer provenance is missing")
        }
        for style in StyleCatalog.categories {
            let image=try StylePosterRenderer.render(style:style.id,seed:55,width:300)
            let other=try StylePosterRenderer.render(style:style.id,seed:55,width:300)
            let first=try rgba(image),second=try rgba(other)
            try require(first==second,"Style recipe is not reproducible")
        }
        print("PASS: weighted style voting, zero exclusion, scale invariance, validation and seeded recipes")
    }
}
