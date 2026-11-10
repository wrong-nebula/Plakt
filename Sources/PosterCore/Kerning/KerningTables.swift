import Foundation

/// Your kerning pairs for one font, kept so every poster set in that font can use them.
/// Scenes copy the pairs they use into their own settings, so a later table edit never changes a saved poster.
public struct KerningTable: Codable, Sendable {
    public var font:String
    public var pairs:[String:Double]
    public var updated:String
    public init(font:String,pairs:[String:Double],updated:Date=Date()) {
        self.font=font;self.pairs=pairs;self.updated=ISO8601DateFormatter().string(from:updated)
    }
}

/// One JSON file per font (by PostScript name) in a folder: the project's `kerning/` beside `taste/`, or Documents/PosterLab/Kerning.
public struct KerningTableStore: Sendable {
    public let directory:URL
    public init(directory:URL) {self.directory=directory}
    /// The project's folder when the app knows the project root, else Documents/PosterLab/Kerning.
    public static func standard(projectRoot:URL?)->KerningTableStore {
        KerningTableStore(directory:projectRoot?.appending(path:"kerning") ?? URL.documentsDirectory.appending(path:"PosterLab/Kerning"))
    }
    func url(_ font:String)->URL {
        let safe=String(font.map{$0.isLetter || $0.isNumber || $0=="-" || $0=="_" ? $0:"_"})
        return directory.appending(path:(safe.isEmpty ? "font":safe)+".json")
    }
    public func load(_ font:String)->KerningTable? {
        guard let data=try? Data(contentsOf:url(font)),let table=try? JSONDecoder().decode(KerningTable.self,from:data),table.font==font else{return nil}
        return table
    }
    /// Saves the pairs, replacing the font's table. Pairs of 0 are dropped.
    public func save(font:String,pairs:[String:Double])throws->KerningTable {
        let kept=pairs.filter{$0.value != 0}
        _=try TextKerning(pairs:kept).validated()
        let table=KerningTable(font:font,pairs:kept)
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys]
        try encoder.encode(table).write(to:url(font),options:.atomic)
        return table
    }
    public func fonts()->[String] {
        let files=(try? FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil)) ?? []
        return files.filter{$0.pathExtension=="json"}.compactMap{(try? Data(contentsOf:$0)).flatMap{try? JSONDecoder().decode(KerningTable.self,from:$0)}?.font}.sorted()
    }
}
