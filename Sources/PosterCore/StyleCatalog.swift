import Foundation

public struct StyleCategory:Identifiable,Sendable {
    public var id:String;public var name:String;public var definition:String
    public var group:String {switch id {case "bauhaus","constructivist": "Geometric traditions";case "minimal","abstract","optical","color-field":"Form & perception";case "halftone","guilloche":"Print & pattern";default:"Typography & layout"}}
    public var displayName:String {switch id {case "bauhaus":"Bauhaus / geometric";case "abstract":"Organic abstraction";case "minimal":"Minimal / reductive";case "swiss":"Swiss / grid typography";case "expressive":"Experimental typography";case "typographic-collage":"Modular type collage";default:name}}

}
public enum StyleCatalog {
    public static let groups=["Geometric traditions","Typography & layout","Form & perception","Print & pattern"]
    public static let categories:[StyleCategory]=[
        .init(id:"bauhaus",name:"Bauhaus",definition:"Geometric forms, primary accents, asymmetry and functional type; a procedural approximation, not an art-historical attribution."),
        .init(id:"abstract",name:"Abstract",definition:"Nonfigurative masses, overlapping forms and reduced dependence on readable text."),
        .init(id:"minimal",name:"Minimal",definition:"Large negative space, few elements and restrained hierarchy."),
        .init(id:"swiss",name:"Swiss",definition:"Grid alignment, clear typographic hierarchy and restrained sans-serif composition."),
        .init(id:"expressive",name:"Expressive",definition:"Declared expressive type, circular lettering and strong scale changes, with readable supporting information."),
        .init(id:"constructivist",name:"Constructivist",definition:"Diagonal structure, geometric masses and directional hierarchy; a procedural interpretation."),
        .init(id:"editorial",name:"Editorial",definition:"Clear information levels, aligned columns and a deliberate relationship between display type and supporting copy."),
        .init(id:"optical",name:"Optical",definition:"Concentric forms, repeated outlines and systematic visual interference."),
        .init(id:"brutalist",name:"Brutalist",definition:"Raw high-contrast type, hard blocks and forceful scale with intact information hierarchy."),
        .init(id:"kinetic",name:"Kinetic type",definition:"Large angled headline fragments create the image; staggered baselines and restrained accent ink preserve reading order."),
        .init(id:"color-field",name:"Color field",definition:"Saturated paper, organic cut-paper silhouettes and declared multiply overprinting produce a reduced color composition."),
        .init(id:"halftone",name:"Tonal halftone",definition:"Procedural three-dimensional forms are shaded with a vector dot screen; type stays separate from tonal imagery."),
        .init(id:"guilloche",name:"Serif & guilloche",definition:"Serif typography contrasts with a mathematically closed, multilayer vector rosette; a contemporary ornamental print direction."),
        .init(id:"typographic-collage",name:"Typographic collage",definition:"Modular type, monograms, circular wordmarks and repeated typographic units, inspired by dense source systems.")
    ]
    public static let qualityJudges=["Composition","Reference","Typography","Rhythm","Diversity","Source structure","Legibility","Hierarchy","Spacing","Type integrity","Alignment","Margins","Negative space","Palette discipline","Ink contrast","Optical balance","Copy completeness"]
    public static var allJudges:[String] {qualityJudges+categories.map(\.name)+DesignerCatalog.profiles.map(\.judgeName)}
    public static var balancedWeights:[String:Double] {Dictionary(uniqueKeysWithValues:(allJudges+["Apple Intelligence"]).map{($0,["Composition","Reference","Typography","Rhythm","Diversity","Apple Intelligence"].contains($0) ? 1:0)})}
    public static func weights(favoring name:String)->[String:Double] {
        var values=balancedWeights
        for key in qualityJudges{values[key]=0.35};values[name]=3;return values
    }
    /// Authored generation neighborhoods. Learned designer heads judge the images;
    /// this routing only supplies suitable starting grammars and does not imitate authorship.
    public static func generationWeights(_ weights:[String:Double])->[String:Double] {
        var result=Dictionary(uniqueKeysWithValues:categories.map{($0.id,max(0,weights[$0.name] ?? 0))})
        let routes:[String:[String]]=[
            "muller-brockmann":["swiss","optical"],"hofmann":["minimal","typographic-collage","editorial"],
            "ruder":["swiss","editorial"],"weingart":["kinetic","expressive","typographic-collage"],
            "tschichold":["editorial","swiss","constructivist"],"bill":["minimal","bauhaus","optical"],
            "aicher":["swiss","bauhaus"],"gerstner":["swiss","optical"],
            "bayer":["bauhaus","constructivist"],"moholy-nagy":["constructivist","abstract"],
            "lissitzky":["constructivist","bauhaus"],"rodchenko":["constructivist","expressive"],
            "cassandre":["editorial","bauhaus"],"bass":["abstract","minimal"],
            "rand":["abstract","minimal","editorial"],"glaser":["guilloche","color-field","expressive"],
            "vignelli":["swiss","editorial","minimal"],"scher":["expressive","brutalist","typographic-collage"],
            "greiman":["expressive","typographic-collage"],"tanaka":["bauhaus","minimal","abstract"],
            "fukuda":["minimal","optical"],"kamekura":["bauhaus","minimal"],
            "yokoo":["expressive","typographic-collage"],"matsunaga":["abstract","minimal"],
            "sato":["halftone","abstract","optical"],"troxler":["expressive","optical","typographic-collage"],
            "schraivogel":["typographic-collage","expressive"]
        ]
        for profile in DesignerCatalog.profiles {
            let weight=max(0,weights[profile.judgeName] ?? 0)
            let styles=routes[profile.id] ?? ["editorial","abstract"]
            for style in styles {result[style,default:0] += weight/Double(styles.count)}
        }
        return result.filter{$0.value>0}
    }
    public static var bundledDirectory:URL? {PosterResources.bundle.url(forResource:"StyleJudges",withExtension:nil,subdirectory:"Resources")}
}
