import options from './options.js'


proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs")
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs")


const projectedLatLng = proj4('EPSG:3857', 'EPSG:4326').forward([2808285, 9608542])
const latlng = { lat: projectedLatLng[0], lng: projectedLatLng[1] }


doStuff()
async function doStuff() {
    const treeHeightRGBA = await wmsLatLngTreeHeight(latlng)
    console.log('tree height:', rbgToTreeHeight(treeHeightRGBA))

    for (let i = 0; i < 5; i++) {
        const z = 6 + i * 2
        await appendImage(latlng, z)
    }
}
async function appendImage(latlng, zoom = 0) {
    const point = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])

    const tileCoords = pointToTileCoords({ x: point[0], y: point[1], z: zoom })
    console.log('tileCoords', tileCoords)

    const treeHeights = await wmsGetMapTile(tileCoords)

    const terrainRBG = await getImage(
        `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=${options.mapboxToken}`
            .replace('{z}', tileCoords.z)
            .replace('{x}', tileCoords.x)
            .replace('{y}', tileCoords.y)
    )


    const osm = await getImage(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            .replace('{z}', tileCoords.z)
            .replace('{x}', tileCoords.x)
            .replace('{y}', tileCoords.y)
    )

    const xyOnTile = xyPositionOnTile(latlng, zoom)
    console.log('xyOnTile', xyOnTile)


    const s = 8
    const putpixel = (ctx, x, y) => ctx.fillRect(x - s / 2, y - s / 2, s, s)

    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    let ctx = canvas.getContext('2d')
    ctx.drawImage(osm, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r1').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    ctx = canvas.getContext('2d')
    ctx.drawImage(terrainRBG, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r2').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    ctx = canvas.getContext('2d')
    ctx.drawImage(treeHeights, 0, 0)
    ctx.fillStyle = 'red'
    putpixel(ctx, xyOnTile.x, xyOnTile.y)
    document.getElementById('r3').appendChild(canvas)
}


function rbgToTreeHeight(rgbArray) {
    const values = new Map([
        ['254,114,0', 1.3],
        ['254,152,70', 5.7],
        ['254,205,165', 8.5],
        ['195,255,195', 10.7],
        ['131,243,115', 12.5],
        ['24,231,22', 14.3],
        ['2,205,0', 16.1],
        ['1,130,0', 18.4],
        ['23,0,220', 21.9],
        ['40,31,149', Infinity]
    ])
    return values.get(rgbArray.slice(0, 3).join(','))
}


/**
 * Hyödynnetävä aineisto:
 * © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
 * haetaan osoitteesta
 * https://kartta.luke.fi/geoserver/MVMI/ows
 */
async function wmsLatLngTreeHeight(latlng) {
    const p = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])
    const treeHeightPixel = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3857', x0: p[0], y0: p[1], x1: p[0] + 1, y1: p[1] + 1, w: 1, h: 1, format: 'image/png'
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    ctx.drawImage(treeHeightPixel, 0, 0)
    return ctx.getImageData(0, 0, 1, 1).data
}


/**
 * Hyödynnetävä aineisto:
 * © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
 * haetaan osoitteesta
 * https://kartta.luke.fi/geoserver/MVMI/ows
 */
async function wmsGetMapTile(tileCoords, w = 256, h = 256) {
    const p = tileCoordsToPoint(tileCoords)
    const tileSize = getTileSize(tileCoords.z)

    const x0 = p.x, y0 = p.y - tileSize, x1 = x0 + tileSize, y1 = y0 + tileSize

    const treeHeights = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3857', x0, y0, x1, y1, w, h, format: 'image/png'
    })
    return treeHeights
}


//https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&request=GetMap&version=1.3.0&layers=keskipituus_1519&srs=EPSG:3067&bbox=308000,6666000,312096,6670096&width=256&height=256&format=image/png
function wmsGetMap(url, {
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


function getImage(url, fetchOptions) {
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


function xyPositionOnTile(latlng, zoom) {
    const tileSize = getTileSize(zoom)
    const p = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])
    const tileXStart = p[0] - p[0] % tileSize
    const tileYStart = p[1] - p[1] % tileSize
    return {
        x: Math.floor((p[0] - tileXStart) / tileSize * 256),
        y: 256 - Math.floor((p[1] - tileYStart) / tileSize * 256)
    }
}
function tileCoordsToPoint({ x, y, z }) {
    const tileSize = getTileSize(z)
    return {
        x: x * tileSize - 20037508.34,
        y: 20037508.34 - y * tileSize
    }
}
function pointToTileCoords({ x, y, z }) {
    const tileSize = getTileSize(z)
    return {
        x: Math.floor((x + 20037508.34) / tileSize),
        y: Math.floor((20037508.34 - y) / tileSize),
        z
    }
}
function getTileSize(z) {
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
function raster2dem(data, heightFunction) {
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

/**
 * Title: Bresenham's line algorithm
 * Author: Jack Elton Bresenham
 * Date: 22.10.2022
 * Source: https://en.wikipedia.org/wiki/Bresenham's_line_algorithm
 */
function getLinePlot(x0, y0, x1, y1) {
    const gridPoints = []

    const dx = Math.abs(x1 - x0)
    const sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0)
    const sy = y0 < y1 ? 1 : -1
    let error = dx + dy

    while (true) {
        gridPoints.push({ x: x0, y: y0 })
        if (x0 == x1 && y0 == y1) break
        const e2 = 2 * error
        if (e2 >= dy) {
            if (x0 == x1) break
            error = error + dy
            x0 = x0 + sx
        }
        if (e2 <= dx) {
            if (y0 == y1) break
            error = error + dx
            y0 = y0 + sy
        }
    }

    return gridPoints
}