import Foundation

public extension PosterShapeLibrary {
    static let contourRecipes:[PosterShapeRecipe] = {
        guard let url=PosterResources.bundle.url(forResource:"ContourRecipes",withExtension:"json",subdirectory:"Resources/ShapeLibrary"),let data=try? Data(contentsOf:url) else{return []}
        return (try? JSONDecoder().decode([PosterShapeRecipe].self,from:data)) ?? []
    }()
}
