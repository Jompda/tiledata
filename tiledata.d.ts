declare interface LatLng {
    lat: number
    lng: number
}
declare interface Point {
    x: number
    y: number
}
declare interface TileCoords {
    x: number
    y: number
    z: number
}

declare module 'tiledata' {
    interface SourceDeclaration<T> {
        name: T
        url: string
        valueFunction: (r: number, g: number, b: number) => number
    }
    export function setConfig<SourceName extends string>(options: {
        sources: Array<
            ({ type: 'wmts' } & SourceDeclaration<SourceName>) |
            ({ type: 'wms', layers: string } & SourceDeclaration<SourceName>)
        >
        saveDataByTile: (name: string, data: Record<SourceName, Int16Array>) => void
        getDataByTile: (name: string) => Record<SourceName, Int16Array>
    }): any
    export function getTiledata<SourceName extends string>
        (tileCoords: TileCoords, sourceNames: SourceName[]): Promise<Record<SourceName, Int16Array>>
    export function getImageData(img: Image, w: number, h: number): Uint8ClampedArray
    export function wmsGetMapTile(url: string, layers: string, tileCoords: TileCoords, w: number, h: number, fetchOptions: RequestInit): Promise<Image>
    export function getImage(url: string, fetchOptions: RequestInit): Promise<Image>
    export function latlngToTileCoords(latlng: LatLng, z: number): TileCoords
    export function latlngToTilePixelCoords(tileCoords, latlng): Point
    export function latlngToXYOnTile(latlng: LatLng, zoom: number): Point
    export function pointToXYOnTile(p: Point, zoom: number): Point
    export function tileCoordsToPoint(tileCoords: TileCoords): Point
    export function pointToTileCoords(p: Point, zoom: number): TileCoords
    export function getTileSize(zoom: number): number
    export function raster2dem(data: Uint8ClampedArray, heightFunction: (r: number, g: number, b: number) => number): Int16Array
}