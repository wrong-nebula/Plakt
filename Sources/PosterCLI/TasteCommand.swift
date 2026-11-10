import Foundation
import PosterCore

struct TasteCommand {
    static func run(_ args:[String])async throws {
        guard let command=args.first,!args.contains("--help") else{print("poster taste index --directory taste --source output [--seed-favourites]\nposter taste profiles [--directory taste]\nposter taste create --name NAME [--directory taste]\nposter taste vote --asset SHA --yes|--no|--clear [--profile personal] [--directory taste]\nposter taste train [--profile personal] [--directory taste]\nposter taste rank --out ranking.json [--profile personal] [--directory taste]\nposter taste calibrate [--mix 'Diversity=0,Designer / Paul Rand=0'] [--tolerance 0] [--out report.json] [--profile personal] [--directory taste]");return}
        var options:[String:String]=[:],flags:Set<String>=[],i=1
        while i<args.count{if ["--yes","--no","--clear","--seed-favourites"].contains(args[i]){flags.insert(args[i]);i+=1}else{guard ["--directory","--source","--name","--profile","--asset","--out","--mix","--tolerance"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown taste option.")};options[args[i]]=args[i+1];i+=2}}
        let directory=URL(fileURLWithPath:options["--directory"] ?? "taste"),store=TasteStore(directory:directory),id=options["--profile"] ?? "personal"
        switch command {
        case "index":let archive=try await store.prepare(outputRoot:URL(fileURLWithPath:options["--source"] ?? "output"),seedFavourites:flags.contains("--seed-favourites"),progress:{print($0)});print("Taste deck: \(archive.assets.count) exact-hash-deduplicated posters, \(archive.profiles.count) profiles.")
        case "profiles":for p in try await store.load().profiles{print("\(p.id) · \(p.name) · \(p.positive) yes / \(p.negative) no · \(p.ready ? "ready":"learning") · weight \(p.enabled ? p.weight:0)")}
        case "create":guard let name=options["--name"] else{throw PosterError.invalid("taste create needs --name.")};print(try await store.createProfile(name:name).id)
        case "vote":guard let asset=options["--asset"],flags.intersection(["--yes","--no","--clear"]).count==1 else{throw PosterError.invalid("taste vote needs --asset and one of --yes, --no, --clear.")};try await store.vote(profileID:id,assetID:asset,yes:flags.contains("--clear") ? nil:flags.contains("--yes"));let profile=try await store.train(profileID:id);print("\(profile.name): \(profile.positive) yes / \(profile.negative) no · \(profile.ready ? "Core ML juror ready":"needs at least 3 yes and 3 no")")
        case "train":let p=try await store.train(profileID:id);print("\(p.name): \(p.ready ? "trained on explicit votes":"needs at least 3 yes and 3 no")")
        case "rank":guard let out=options["--out"] else{throw PosterError.invalid("taste rank needs --out.")};let archive=try await store.load();guard let profile=archive.profiles.first(where:{$0.id==id}),profile.ready else{throw PosterError.invalid("Train the selected profile with at least 3 yes and 3 no votes first.")};let bank=try TasteJudgeBank(directory:directory);var rows:[[String:String]]=[];for asset in archive.assets{if let score=try bank.scores(features:asset.features)[profile.judgeName]{rows.append(["id":asset.id,"image":asset.imageURL.path,"score":String(score),"title":asset.title,"candidateID":asset.candidateID])}};rows.sort{Double($0["score"]!)!>Double($1["score"]!)!};try LibraryRaster.write(rows,to:URL(fileURLWithPath:out));print("Ranked \(rows.count) posters with \(profile.name).")
        case "calibrate":
            var mix:[String:Double]?
            if let value=options["--mix"] {
                var weights:[String:Double]=[:]
                for part in value.split(separator:","){let pair=part.split(separator:"=");guard pair.count==2,let weight=Double(pair[1]) else{throw PosterError.invalid("Use --mix 'Judge=weight,Judge=weight'.")};weights[String(pair[0])]=weight}
                mix=weights
            }
            guard let tolerance=Double(options["--tolerance"] ?? "0") else{throw PosterError.invalid("--tolerance must be a number.")}
            let report=try JuryCalibrator.calibrate(archive:try await store.load(),profileID:id,mix:mix,tolerance:tolerance)
            func line(_ r:JuryReplay)->String{String(format:"%@: AUC %.3f ± %.3f · your yes posters that won: %ld/%ld · no posters that won: %ld/%ld",r.label,r.auc,r.standardError,r.yesWinners,report.yes,r.noWinners,report.no)+(r.label=="Stored rankings" ? "":" · \(r.changedWinners)/\(report.rounds) round winners changed")}
            print("\(report.profileName): \(report.yes) yes / \(report.no) no votes across \(report.rounds) rounds; \(report.unmatched) votes have no round.json.")
            print(line(report.stored));print(line(report.replay))
            print("Judges, by agreement with your votes (raw scores; 0.5 = chance):")
            for j in report.judges{print(String(format:"  %.3f ± %.3f  %@",j.auc,j.standardError,j.judge)+(j.votingRounds==0 ? "  · no ballot":"  · weight \(j.maximumWeight) in \(j.votingRounds) rounds"+(j.flatRounds>0 ? ", flat in \(j.flatRounds)":"")))}
            if let out=options["--out"]{try LibraryRaster.write(report,to:URL(fileURLWithPath:out));print("Wrote \(out)")}
        default:throw PosterError.invalid("Unknown taste command.")
        }
    }
}
