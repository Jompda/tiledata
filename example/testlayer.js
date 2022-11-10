import options from './options.js'
import { getImage, wmsGetMapTile, tileCoordsToPoint, pointToTileCoords, latlngToXYOnTile, pointToXYOnTile } from '../tiledata.js'


L.GridLayer.elevationlayer = L.GridLayer.extend({
    createTile: function (coords, callback) {
        const canvas = L.DomUtil.create('canvas', 'leaflet-tile')
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext('2d')
        const gd = async () => {
            const terrainRGB = await getImage(
                `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token=${options.mapboxToken}`
                    .replace('{z}', coords.z)
                    .replace('{x}', coords.x)
                    .replace('{y}', coords.y)
            )
            ctx.drawImage(terrainRGB, 0, 0)
            setTimeout(() => callback(null, canvas), 0)
        }
        gd()
        return canvas
    }
})

L.GridLayer.treelayer = L.GridLayer.extend({
    createTile: function (coords, callback) {
        const canvas = L.DomUtil.create('canvas', 'leaflet-tile')
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext('2d')
        const gd = async () => {
            const treeHeights = await wmsGetMapTile('https://kartta.luke.fi/geoserver/MVMI/ows?', 'keskipituus_1519', coords)
            ctx.drawImage(treeHeights, 0, 0)
            setTimeout(() => callback(null, canvas), 0)
        }
        gd()
        return canvas
    }
})

L.GridLayer.infolayer = L.GridLayer.extend({
    createTile: function (coords) {
        const canvas = L.DomUtil.create('canvas', 'leaflet-tile')
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext('2d')

        ctx.strokeRect(0, 0, 256, 256)
        const coordText = [coords.x, coords.y, coords.z].join(', ')
        const coordsToPoint = tileCoordsToPoint(coords)
        const pointToCoords = pointToTileCoords(coordsToPoint, coords.z)

        const bounds = this._tileCoordsToBounds(coords)
        const sw = { lat: bounds._southWest.lat + Math.random(), lng: bounds._southWest.lng + Math.random() }
        const projP = proj4('EPSG:4326', 'EPSG:3857').forward([sw.lng, sw.lat])

        const llxyOnTile = latlngToXYOnTile(sw, coords.z)
        const pxyOnTile = pointToXYOnTile(projP, coords.z)

        const s = 8
        const putpixel = (ctx, x, y) => ctx.fillRect(x - s / 2, y - s / 2, s, s)
        ctx.fillStyle = 'red'
        putpixel(ctx, llxyOnTile.x, llxyOnTile.y)

        ctx.fillStyle = 'black'
        ctx.fillText(coordText, 0, 10)
        ctx.fillText('coordsToPoint: x=' + Math.floor(coordsToPoint.x) + ' y=' + Math.floor(coordsToPoint.y), 0, 20)
        ctx.fillText('pointToCoords: x=' + pointToCoords.x + ' y=' + pointToCoords.y + ' z=' + pointToCoords.z, 0, 30)
        ctx.fillText(`sw + Math.random:`, 0, 40)
        ctx.fillText(`  lat=${sw.lat}`, 0, 50)
        ctx.fillText(`  lng=${sw.lng}`, 0, 60)
        ctx.fillText(`projP: x=${Math.round(projP[0])} y=${Math.round(projP[1])}`, 0, 70)
        ctx.fillText(`latlngToXYOnTile: x=${llxyOnTile.x} y=${llxyOnTile.y}`, 0, 80)
        ctx.fillText(`pointToXYOnTile: x=${pxyOnTile.x} y=${pxyOnTile.y}`, 0, 90)

        return canvas
    }
})