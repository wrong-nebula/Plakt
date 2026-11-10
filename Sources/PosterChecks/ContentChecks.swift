import Foundation
import PosterCore

extension PosterChecks {
    static func checkContent()throws {
        let briefs=ContentBriefLibrary.briefs
        try require(briefs.count>=22 && briefs.filter{$0.sourcePosterID != nil}.count>=8,"Real content library or poster-derived briefs missing")
        try require(Set(briefs.map(\.id)).count==briefs.count,"Duplicate content brief IDs")
        let day=ISO8601DateFormatter().date(from:"2026-11-07T12:00:00Z")!
        for brief in briefs {
            _ = try brief.posterCopy.validated()
            try require(!brief.displayPhrases.isEmpty && !brief.institution.isEmpty && brief.startDate<=brief.endDate,"Content brief has incomplete names, venue or dates")
            try require(brief.sourcePosterID != nil || !brief.sources.isEmpty,"Event brief has no factual provenance")
            try require(brief.sources.allSatisfy{$0.url.scheme=="https" && !$0.evidence.isEmpty},"Event source URL/evidence is invalid")
            let bytes=try JSONEncoder().encode(brief.posterCopy),restored=try JSONDecoder().decode(PosterCopy.self,from:bytes)
            try require(restored==brief.posterCopy,"Content/display phrases are not preserved in saved copy")
        }
        try require(briefs.allSatisfy{$0.isConcept==true && $0.inspiredByID != nil && $0.inspirationTitle != nil},"Inspired briefs are not distinguished from their factual references")
        try require(briefs.allSatisfy{$0.status(at:day)=="Concept brief · real location"},"Imagined events are presented as announced events")
        let original=ContentBriefLibrary.brief("concept-asawa-beyeler-2026")!
        try require(original.referenceEndDate=="2027-01-10" && original.title != "RUTH ASAWA","Source facts or rewritten concept identity lost")
        let mixed=(0..<22).compactMap{ContentBriefLibrary.choose(seed:2026,offset:$0)?.id}
        try require(Set(mixed).count==22 && ContentBriefLibrary.copy(seed:2026)==ContentBriefLibrary.copy(seed:2026),"Brief mixing is not reproducible or does not cover the library")
        try require(!ContentBriefLibrary.copy().title.contains("VISUAL"),"User-facing default content is still the generic type fixture")
        print("PASS: 22 inspired briefs with real places, 8 source-poster references, dated provenance, explicit concept labels and deterministic content rotation")
    }
}
