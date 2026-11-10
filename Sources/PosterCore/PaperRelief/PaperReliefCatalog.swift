import Foundation
public extension PosterShapeLibrary {
    static let paperReliefRecipes:[PosterShapeRecipe] = {
        guard let url=PosterResources.bundle.url(forResource:"PaperReliefRecipes",withExtension:"json",subdirectory:"Resources/ShapeLibrary"),let data=try? Data(contentsOf:url) else{return []}
        return (try? JSONDecoder().decode([PosterShapeRecipe].self,from:data)) ?? []
    }()
}
