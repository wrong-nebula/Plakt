import AppKit
import Foundation
import CoreText

/// Original production implementation, retained unchanged as the fallback.
public enum PreviousTextWrapping {
    public static func lines(_ text:String,width:Double,height:Double,aspect:Double,font:String)->[String] {
        let face=CTFontCreateWithName(font as CFString,100,nil)
        func fits(_ s:String)->Bool {
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:s,attributes:[.font:face]))
            let r=CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
            return r.height<=0 || r.width/r.height*height*aspect<=width
        }
        var result:[String]=[],current=""
        for word in text.split(whereSeparator:{$0.isWhitespace}).map(String.init) {
            let next=current.isEmpty ? word:current+" "+word
            if fits(next){current=next}else{
                if !current.isEmpty{result.append(current);current=""}
                for character in word {
                    if !fits(current+String(character)),!current.isEmpty{result.append(current);current=""}
                    current.append(character)
                }
            }
        }
        if !current.isEmpty{result.append(current)}
        return result
    }
}
