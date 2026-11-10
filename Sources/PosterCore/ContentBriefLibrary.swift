import Foundation

public struct ContentBriefSource:Codable,Hashable,Sendable {public var url:URL;public var evidence:String}
public struct PosterContentBrief:Codable,Hashable,Identifiable,Sendable {
    public var id:String;public var name:String;public var kind:String
    public var title:String;public var subtitle:String;public var institution:String;public var footer:String
    public var startDate:String;public var endDate:String;public var dateLabel:String;public var city:String
    public var displayPhrases:[String];public var verifiedAt:String;public var sources:[ContentBriefSource]
    public var isConcept:Bool? = nil
    public var inspiredByID:String? = nil
    public var inspirationTitle:String? = nil
    public var referenceStartDate:String? = nil
    public var referenceEndDate:String? = nil
    public var basis:String;public var sourcePosterID:String?;public var posterEvidence:String?
    public var posterCopy:PosterCopy {
        var copy=PosterCopy(title:title,subtitle:subtitle,institution:institution,footer:footer)
        copy.briefID=id;copy.displayPhrases=displayPhrases;return copy
    }
    public func status(at date:Date=Date())->String {
        if isConcept==true{return "Concept brief · real location"}
        let formatter=DateFormatter();formatter.locale=Locale(identifier:"en_US_POSIX");formatter.timeZone=TimeZone(secondsFromGMT:0);formatter.dateFormat="yyyy-MM-dd"
        let today=formatter.string(from:date)
        return endDate<today ? "Archive example":startDate>today ? "Upcoming event":"Current event"
    }
}
public enum ContentBriefLibrary {
    public static let briefs:[PosterContentBrief]={
        struct Catalog:Decodable{var briefs:[PosterContentBrief]}
        guard let url=PosterResources.bundle.url(forResource:"content-briefs",withExtension:"json",subdirectory:"Resources"),let data=try? Data(contentsOf:url),let catalog=try? JSONDecoder().decode(Catalog.self,from:data) else{return []}
        return catalog.briefs
    }()
    public static func brief(_ id:String?)->PosterContentBrief? {guard let id else{return nil};return briefs.first{$0.id==id}}
    public static func choose(seed:UInt64,offset:Int=0)->PosterContentBrief? {
        guard !briefs.isEmpty else{return nil}
        let index=(Int(seed%UInt64(briefs.count))+offset)%briefs.count
        return briefs[index]
    }
    public static func copy(seed:UInt64=2026,offset:Int=0)->PosterCopy {choose(seed:seed,offset:offset)?.posterCopy ?? PosterCopy()}
}
