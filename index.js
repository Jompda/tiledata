import options from './options.js'
// RGBA-data: ctx.getImageData(0, 0, w, h).data

// Zoom levelin laatan leveys pseudo mercator projektiolla
// (20037508.34 - -20037508.34 ) / (2**z)

function pointToTileCoords(x, y, z) {
    const size = getTileSize(z)
    x += 20037508.34
    //y += size //??
    return {
        x: Math.floor(x / size),
        y: Math.floor(y / size),
        z
    }
}
function getTileSize(z) {
    return (20037508.34 - -20037508.34) / (2 ** z)
}

doStuff()
async function doStuff() {
    await appendImage(0, 0, 5)
    await appendImage(0, 0, 6)
    await appendImage(0, 0, 7)
    await appendImage(0, 0, 8)
    await appendImage(0, 0, 9)
    await appendImage(0, 0, 10)
    await appendImage(0, 0, 11)
}
async function appendImage(xOffset = 0, yOffset = 0, zoom = 0) {
    // TODO: selvitä miten gridin koordinaatit saa muunnettua xy-koordinaateiksi, tällä hetkelle fakissa
    const tileSize = getTileSize(zoom)
    const point = {
        x: 2808285.721217,
        y: 9608542.242187
    }
    point.x -= point.x % tileSize - 1
    point.y -= point.y % tileSize - 1
    console.log(point)

    const tileCoords = pointToTileCoords(point.x + xOffset * tileSize, point.y + yOffset * tileSize, zoom)
    console.log(tileCoords)


    const w = 256, h = 256
    const x0 = point.x + xOffset * tileSize, y0 = point.y + yOffset * tileSize, x1 = x0 + tileSize, y1 = y0 + tileSize


    const treeHeights = await wmsGetMap('https://kartta.luke.fi/geoserver/MVMI/ows?', {
        layers: 'keskipituus_1519', srs: 'EPSG:3857', x0, y0, x1, y1, w, h, format: 'image/png'
    })

    const terrainRBGUrl = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{Z}/{X}/{Y}.pngraw?access_token=${options.mapboxToken}`
        .replace('{Z}', tileCoords.z)
        .replace('{X}', tileCoords.x)
        .replace('{Y}', tileCoords.y)
    const terrainRBG = await getImage(terrainRBGUrl)


    const osm = await getImage(
        'https://tile.openstreetmap.org/{Z}/{X}/{Y}.png'
            .replace('{Z}', tileCoords.z)
            .replace('{X}', tileCoords.x)
            .replace('{Y}', tileCoords.y)
    )



    let canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    let ctx = canvas.getContext('2d')
    ctx.drawImage(terrainRBG, 0, 0)
    document.getElementById('r1').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    ctx = canvas.getContext('2d')
    ctx.drawImage(osm, 0, 0)

    document.getElementById('r2').appendChild(canvas)

    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    ctx = canvas.getContext('2d')
    ctx.drawImage(treeHeights, 0, 0)

    document.getElementById('r3').appendChild(canvas)


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

//https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&request=GetMap&version=1.3.0&layers=keskipituus_1519&srs=EPSG:3067&bbox=308000,6666000,312096,6670096&width=256&height=256&format=image/png
function wmsGetMap(url, {
    version = '1.3.0', layers, srs = 'EPSG:3857', x0, y0, x1, y1, w, h, format = 'image/png'
}, fetchOptions) {
    return new Promise((resolve, reject) => {
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
        fetch(imgUrl, fetchOptions)
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