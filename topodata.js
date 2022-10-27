import options from './options.js'


proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs")
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs")


const config = {
    elevationUrl: `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=${options.mapboxToken}`,
    elevationHeightFunction: function (R, G, B) {
        return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
    },
    treeHeightUrl: 'https://kartta.luke.fi/geoserver/MVMI/ows?',
    treeHeightFunction: function (r, g, b) {
        return Math.ceil(rgbToTreeHeight([r, g, b]))
    },
    saveDataByTile: undefined,
    getDataByTile: undefined,
    timeout: 2500
}
export function setConfig({
    elevationUrl,
    elevationHeightFunction,
    treeHeightUrl,
    treeHeightFunction,
    saveDataByTile,
    getDataByTile
}) {
    if (elevationUrl) config.elevationUrl = elevationUrl
    if (elevationHeightFunction) config.elevationHeightFunction = elevationHeightFunction
    if (treeHeightUrl) config.treeHeightUrl = treeHeightUrl
    if (treeHeightFunction) config.treeHeightFunction = treeHeightFunction
    if (saveDataByTile) config.saveDataByTile = saveDataByTile
    if (getDataByTile) config.getDataByTile = getDataByTile
}


export async function getTopodataByTile(tileCoords, {
    elevation,
    treeHeight
}) {
    const tileName = `${tileCoords.x}|${tileCoords.y}|${tileCoords.z}`
    let tileData = config.getDataByTile ? config.getDataByTile(tileName) : undefined
    if (!tileData) tileData = {}
    if (!tileData.elevation) {
        tileData.elevation = raster2dem(getImageData(await getImage(
            config.elevationUrl
                .replace('{z}', tileCoords.z)
                .replace('{x}', tileCoords.x)
                .replace('{y}', tileCoords.y)
        ), 256, 256), config.elevationHeightFunction)
    }
    if (!tileData.treeHeight) {
        tileData.treeHeight = raster2dem(getImageData(await wmsGetMapTile(
            tileCoords
        ), 256, 256), config.treeHeightFunction)
    }
    if (config.saveDataByTile) config.saveDataByTile(tileName, tileData)

    return {
        elevation: elevation ? tileData.elevation : undefined,
        treeHeight: treeHeight ? tileData.treeHeight : undefined
    }
}


function getImageData(img, w, h) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, w, h).data
}


/**
 * Hyödynnetävä aineisto:
 * © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
 * värit haettu osoitteesta:
 * https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&width=20&height=20&layer=keskipituus_1519
 * Luken tiedostopalvelusta saa ladattua lehtijaon mukaan laatat, joissa puiden korkeus on 16x16m sluilla desimetrin tarkkuudella.
 * Arvoja ei olla porrastettu samoin kuin WMS-palvelimella ja aineisto tarjoaa myös korkeampia arvoja käytöön kuin 220dm.
 * Koska arvot ovat porrastettu ja viimeinen väri kattaa 220dm - ääretön, niin käytetään sitten suomen korkeimman puun pituutta kyseisellä arvolla :D
 * @param {*} rgbArray 
 * @returns 
 */
function rgbToTreeHeight(rgbArray) {
    const values = new Map([
        ['255,255,255', 0],
        ['151,71,73', 0],
        ['254,114,0', 1.3],
        ['254,152,70', 5.7],
        ['254,205,165', 8.5],
        ['195,255,195', 10.7],
        ['131,243,115', 12.5],
        ['24,231,22', 14.3],
        ['2,205,0', 16.1],
        ['1,130,0', 18.4],
        ['23,0,220', 21.9],
        ['40,31,149', 47]
    ])
    return values.get(rgbArray.join(','))
}


/**
 * Linkkien laskentaan tilen käyttö on varmaan paljon parempi vaihtoehto,
 * koska sen voi cachettaa ja yhellä requestilla saa monta pistettä laskettua kerralla. 
 * Hyödynnetävä aineisto:
 * © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
 * haetaan osoitteesta
 * https://kartta.luke.fi/geoserver/MVMI/ows
 */
export async function wmsLatLngTreeHeight(latlng) {
    const p = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])
    const treeHeightPixel = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3857', x0: p[0], y0: p[1], x1: p[0] + 1, y1: p[1] + 1, w: 1, h: 1, format: 'image/png'
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    ctx.drawImage(treeHeightPixel, 0, 0)
    return rgbToTreeHeight(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
}


/**
 * Hyödynnetävä aineisto:
 * © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
 * haetaan osoitteesta
 * https://kartta.luke.fi/geoserver/MVMI/ows
 */
export async function wmsGetMapTile(tileCoords, w = 256, h = 256) {
    const p = tileCoordsToPoint(tileCoords)
    const tileSize = getTileSize(tileCoords.z)

    const x0 = p.x, y0 = p.y - tileSize, x1 = x0 + tileSize, y1 = y0 + tileSize

    const treeHeights = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3857', x0, y0, x1, y1, w, h, format: 'image/png'
    })
    return treeHeights
}


//https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&request=GetMap&version=1.3.0&layers=keskipituus_1519&srs=EPSG:3067&bbox=308000,6666000,312096,6670096&width=256&height=256&format=image/png
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
        x: Math.floor((p[0] - tileXStart) / tileSize * 256),
        y: 255 - Math.floor((p[1] - tileYStart) / tileSize * 256)
    }
}
export function tileCoordsToPoint({ x, y, z }) {
    const tileSize = getTileSize(z)
    return {
        x: x * tileSize - 20037508.34,
        y: 20037508.34 - y * tileSize
    }
}
export function pointToTileCoords({ x, y, z }) {
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
 * Title: leaflet-topography
 * Author: Seth "slutske22" Lutske
 * Date: 22.10.2022
 * Source: https://github.com/slutske22/leaflet-topography
 * @param {*} data 
 * @param {*} heightFunction 
 * @returns {Int16Array}
 */
export function raster2dem(data, heightFunction) {
    const dem = new Int16Array(256 * 256);

    var x, y, i, j;

    const height =
        heightFunction ||
        function (R, G, B) {
            return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
        };

    for (x = 0; x < 256; x++) {
        for (y = 0; y < 256; y++) {
            i = x + y * 256;
            j = i * 4;
            dem[i] = height(data[j], data[j + 1], data[j + 2]);
        }
    }

    return dem;
}