proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs")
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs")


let sources
let res = 256
let saveDataByTile
let getDataByTile


/**
 * Source url with type wmts shall contain substrings "{x}", "{y}", and "{z}" to be replaced with the corresponding coordinates.
 * @param {{
 * sources: [{
 *   name: string,
 *   type: 'wmts' | 'wms',
 *   url: string,
 *   layers?: string,
 *   fetchOptions: {},
 *   valueFunction: (r: number, g: number, b: number) => number
 * }],
 * tileSize?: number,
 * saveDataByTile: (name: string, data: any),
 * getDataByTile: (name: string)
 * }} options 
 */
export function setConfig(options) {
    sources = options.sources
    if (options.tileSize) res = options.tileSize
    saveDataByTile = options.saveDataByTile
    getDataByTile = options.getDataByTile
}


/**
 * @param {{x: number, y: number, z: number}} tileCoords 
 * @param {string[]} sourceNames Pointing to previously defined sources by their name.
 * @returns {Promise} Resolves to an object containing Int16Arrays of the retrieved data by their names.
 */
export function getTiledata(tileCoords, sourceNames) {
    if (!sources) throw new Error('Sources must be specified with setConfig before calling this function!')
    return new Promise((resolve, reject) => {
        const tileName = `${tileCoords.x}|${tileCoords.y}|${tileCoords.z}`
        let tileData = getDataByTile ? getDataByTile(tileName) : undefined
        if (!tileData) tileData = {}

        const check = asyncOperation(sources.length, undefined, () => {
            if (saveDataByTile) saveDataByTile(tileName, tileData)
            resolve(tileData)
        })
        for (const source of sourceNames) {
            if (!tileData[source]) {
                const srcConfig = sources.find(a => a.name == source)
                if (srcConfig.type == 'wmts') {
                    getImage(
                        srcConfig.url
                            .replace('{z}', tileCoords.z)
                            .replace('{x}', tileCoords.x)
                            .replace('{y}', tileCoords.y),
                        srcConfig.fetchOptions
                    ).then(img => {
                        tileData[source] = raster2dem(getImageData(img, res, res), srcConfig.valueFunction)
                        check()
                    }).catch(reject)
                }
                else if (srcConfig.type == 'wms') {
                    wmsGetMapTile(
                        srcConfig.url, srcConfig.layers, tileCoords, res, res, srcConfig.fetchOptions
                    ).then(img => {
                        tileData[source] = raster2dem(getImageData(img, res, res), srcConfig.valueFunction)
                        check()
                    }).catch(reject)
                }
            } else check()
        }
    })
}


function getImageData(img, w, h) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, w, h).data
}


export async function wmsGetMapTile(url, layers, tileCoords, w = res, h = res, fetchOptions) {
    const p = tileCoordsToPoint(tileCoords)
    const tileSize = getTileSize(tileCoords.z)

    const x0 = p.x, y0 = p.y - tileSize, x1 = x0 + tileSize, y1 = y0 + tileSize

    const treeHeights = await wmsGetMap(url, {
        layers, srs: 'EPSG:3857', x0, y0, x1, y1, w, h, format: 'image/png'
    }, fetchOptions)
    return treeHeights
}


export function wmsGetMap(url, {
    version = '1.3.0', layers, srs = 'EPSG:3857', x0, y0, x1, y1, w, h, format = 'image/png'
}, fetchOptions) {
    const imgUrl = url + (url[url.length - 1] == '?' ? '' : '?') +
        `service=WMS&` +
        `request=GetMap&` +
        `version=${version}&` +
        `layers=${layers}&` +
        `srs=${srs}&` +
        `bbox=${x0},${y0},${x1},${y1}&` +
        `width=${w}&` +
        `height=${h}&` +
        `format=${format}`
    return getImage(imgUrl, fetchOptions)
}


export function getImage(url, fetchOptions) {
    return new Promise((resolve, reject) => {
        fetch(url, fetchOptions)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob)
                let img = new Image()
                img.crossOrigin = '*'
                img.onload = () => resolve(img)
                img.onerror = reject
                img.src = blobUrl
            })
    })
}


export function xyPositionOnTile(latlng, zoom) {
    const tileSize = getTileSize(zoom)
    const p = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])
    const tileXStart = p[0] - p[0] % tileSize
    const tileYStart = p[1] - p[1] % tileSize
    return {
        x: Math.floor((p[0] - tileXStart) / tileSize * res),
        y: 255 - Math.floor((p[1] - tileYStart) / tileSize * res)
    }
}
export function tileCoordsToPoint({ x, y, z }) {
    const tileSize = getTileSize(z)
    return {
        x: x * tileSize - 20037508.34,
        y: 20037508.34 - y * tileSize
    }
}
export function pointToTileCoords({ x, y }, z) {
    const tileSize = getTileSize(z)
    return {
        x: Math.floor((x + 20037508.34) / tileSize),
        y: Math.floor((20037508.34 - y) / tileSize),
        z
    }
}
export function getTileSize(z) {
    return 2 * 20037508.34 / (2 ** z)
}


/**
 * A function which transforms imageData to a digital elevation model.
 * Modified to support different resolutions.
 * Source: https://github.com/slutske22/leaflet-topography
 * Retrieved: 22.10.2022
 */
export function raster2dem(data, heightFunction) {
    const dem = new Int16Array(res * res);

    var x, y, i, j;

    const height =
        heightFunction ||
        function (R, G, B) {
            return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
        };

    for (x = 0; x < res; x++) {
        for (y = 0; y < res; y++) {
            i = x + y * res;
            j = i * 4;
            dem[i] = height(data[j], data[j + 1], data[j + 2]);
        }
    }

    return dem;
}


function asyncOperation(calls, step = () => { }, done = () => { }) {
    let called = 0
    return () => {
        step()
        if (++called === calls) done()
        else if (called > calls) throw new Error('Received too many calls.')
    }
}