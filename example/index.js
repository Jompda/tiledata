import options from './options.js'


import { setConfig, getTiledata, pointToTileCoords, wmsGetMapTile, getImage, xyPositionOnTile } from '../tiledata.js'


const tileDataStorage = new Map()
setConfig({
    sources: [
        {
            name: 'elevation',
            type: 'wmts',
            // Source: https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/
            url: `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=${options.mapboxToken}`,
            valueFunction: function (R, G, B) {
                return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
            }
        },
        {
            name: 'treeHeight',
            type: 'wms',
            // Attribution: © Luonnonvarakeskus, 2019, keskipituus_1519, Monilähteisen valtakunnan metsien inventoinnin (MVMI) kartta-aineisto 2017
            url: 'https://kartta.luke.fi/geoserver/MVMI/ows?',
            layers: 'keskipituus_1519',
            valueFunction: function (r, g, b) {
                // Colors retrieved from: https://kartta.luke.fi/geoserver/MVMI/ows?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&width=20&height=20&layer=keskipituus_1519
                // Due to value incrementation and the last increment being 220dm - infinity, let's just use Finland's tallest tree as the max value :D
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
                return Math.ceil(values.get([r, g, b].join(',')))
            }
        }
    ],
    saveDataByTile: (name, data) => {
        tileDataStorage.set(name, data)
    },
    getDataByTile: (name) => tileDataStorage.get(name)
})


//const projectedLatLng = proj4('EPSG:3857', 'EPSG:4326').forward([2808285, 9608542])
//const latlng = { lat: projectedLatLng[0], lng: projectedLatLng[1] }
const latlng1 = { lat: 22, lng: 60 }
const latlng2 = { lat: 30, lng: 69 }

doStuff()
async function doStuff() {
    await appendRandomImages()
    /*setInterval(() => {
        document.getElementById('r1').innerHTML = ''
        document.getElementById('r2').innerHTML = ''
        document.getElementById('r3').innerHTML = ''
        appendRandomImages()
    }, 6000)*/
}


async function appendRandomImages() {
    const z = 8
    const dLat = latlng2.lat - latlng1.lat
    const dLng = latlng2.lng - latlng1.lng
    for (let i = 0; i < 5; i++) {
        const latlng = {
            lat: latlng1.lat + Math.random() * dLat,
            lng: latlng1.lng + Math.random() * dLng
        }
        await appendImage(latlng, z)
    }
}
async function appendImage(latlng, zoom = 0) {
    const point = proj4('EPSG:4326', 'EPSG:3857').forward([latlng.lat, latlng.lng])
    const tileCoords = pointToTileCoords({ x: point[0], y: point[1], z: zoom })
    const xyOnTile = xyPositionOnTile(latlng, zoom)

    const startTime = Date.now()
    const result = await getTiledata(tileCoords, [
        'elevation', 'treeHeight'
    ])
    console.log('Tiledata retrieve and calculation time:', Date.now() - startTime, 'ms')


    // Just for visualizing the retrieved data
    const treeHeights = await wmsGetMapTile('https://kartta.luke.fi/geoserver/MVMI/ows?', 'keskipituus_1519', tileCoords)
    const terrainRGB = await getImage(
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

    console.table([
        ['lat, lng', 'zoom', 'elevation', 'tree height'],
        [latlng.lat + ', ' + latlng.lng, zoom, result.elevation[xyOnTile.y * 256 + xyOnTile.x] + 'm', result.treeHeight[xyOnTile.y * 256 + xyOnTile.x] + 'm']
    ])

    const s = 8
    const putpixel = (ctx, x, y) => ctx.fillRect(x - s / 2, y - s / 2, s, s)
    function createCanvas(img, p) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        ctx.fillStyle = 'red'
        putpixel(ctx, p.x, p.y)
        return canvas
    }

    document.getElementById('r1').appendChild(createCanvas(osm, xyOnTile))
    document.getElementById('r2').appendChild(createCanvas(terrainRGB, xyOnTile))
    document.getElementById('r3').appendChild(createCanvas(treeHeights, xyOnTile))
}




/**
 * Bresenham's line algorithm modified for javascript
 * Source: https://en.wikipedia.org/wiki/Bresenham's_line_algorithm
 * Retrieved: 22.10.2022
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