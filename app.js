let map;
let lapPolylines = []; // Array to store lap polylines
let averageLinePolyline = null; // To store the average line polyline

function initMap() {
    const mapOptions = {
        center: { lat: 39.8283, lng: -98.5795 }, // Center of the US
        zoom: 4,
    };
    map = new google.maps.Map(document.getElementById('map'), mapOptions);

    const kmlUpload = document.getElementById('kml-upload');
    kmlUpload.addEventListener('change', handleFileUpload);

    const toggleEditBtn = document.getElementById('toggle-edit-btn');
    toggleEditBtn.addEventListener('click', toggleEditMode);

    const toggleMoveBtn = document.getElementById('toggle-move-btn');
    toggleMoveBtn.addEventListener('click', toggleMoveMode);
}

function handleFileUpload(event) {
    clearLaps();

    const files = event.target.files;
    if (!files.length) {
        return;
    }

    const allPaths = [];
    let filesRead = 0;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const kmlContent = e.target.result;
            const coordinates = parseKML(kmlContent);
            if (coordinates.length > 0) {
                drawLap(coordinates);
                allPaths.push(coordinates);
            }

            filesRead++;
            if (filesRead === files.length && allPaths.length > 0) {
                fitMapToLaps(allPaths);
                const averagePath = calculateAverageLine(allPaths);
                if (averagePath.length > 0) {
                    drawAverageLine(averagePath);
                }
            }
        };
        reader.readAsText(file);
    }
}

function drawLap(path) {
    const lapPolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000', // Red color for the lap
        strokeOpacity: 0.8,
        strokeWeight: 2
    });
    lapPolyline.setMap(map);
    lapPolylines.push(lapPolyline);
}

function drawAverageLine(path) {
    averageLinePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#0000FF', // Blue color for average line
        strokeOpacity: 0.8,
        strokeWeight: 4
    });
    averageLinePolyline.setMap(map);
    document.getElementById('toggle-edit-btn').disabled = false;
    document.getElementById('toggle-move-btn').disabled = false;
}

function toggleEditMode() {
    if (!averageLinePolyline) return;

    const isEditable = averageLinePolyline.getEditable();
    averageLinePolyline.setEditable(!isEditable);

    // If turning edit mode ON, make sure move mode is OFF.
    if (!isEditable) {
        if (averageLinePolyline.getDraggable()) {
            averageLinePolyline.setDraggable(false);
            document.getElementById('toggle-move-btn').textContent = 'Move Line';
        }
    }

    document.getElementById('toggle-edit-btn').textContent = !isEditable ? 'Finish Editing' : 'Toggle Edit Mode';
}

function toggleMoveMode() {
    if (!averageLinePolyline) return;

    const isDraggable = averageLinePolyline.getDraggable();
    averageLinePolyline.setDraggable(!isDraggable);

    // If turning move mode ON, make sure edit mode is OFF.
    if (!isDraggable) {
        if (averageLinePolyline.getEditable()) {
            averageLinePolyline.setEditable(false);
            document.getElementById('toggle-edit-btn').textContent = 'Toggle Edit Mode';
        }
    }

    document.getElementById('toggle-move-btn').textContent = !isDraggable ? 'Finish Moving' : 'Move Line';
}

function clearLaps() {
    for (let i = 0; i < lapPolylines.length; i++) {
        lapPolylines[i].setMap(null);
    }
    lapPolylines = [];

    if (averageLinePolyline) {
        averageLinePolyline.setMap(null);
        averageLinePolyline = null;
    }

    const toggleEditBtn = document.getElementById('toggle-edit-btn');
    toggleEditBtn.disabled = true;
    toggleEditBtn.textContent = 'Toggle Edit Mode';

    const toggleMoveBtn = document.getElementById('toggle-move-btn');
    toggleMoveBtn.disabled = true;
    toggleMoveBtn.textContent = 'Move Line';
}

function fitMapToLaps(paths) {
    const bounds = new google.maps.LatLngBounds();
    paths.forEach(path => {
        path.forEach(point => {
            bounds.extend(point);
        });
    });
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
}

function parseKML(kmlContent) {
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlContent, "application/xml");
    const coordinateNodes = kml.getElementsByTagName('coordinates');

    if (coordinateNodes.length === 0) {
        console.error("No <coordinates> element found in KML file.");
        return [];
    }

    const coordinatesText = coordinateNodes[0].textContent.trim();
    const coordinatesArray = coordinatesText.split(/\s+/);

    const path = coordinatesArray.map(coordStr => {
        const [lng, lat] = coordStr.split(',').map(Number);
        return { lat: lat, lng: lng };
    }).filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng));

    return path;
}


// =============================================
// Average Line Calculation
// =============================================

function calculateAverageLine(paths, numPoints = 200) {
    const averagePath = [];
    const totalDistances = paths.map(path => getTotalDistance(path));

    for (let i = 0; i < numPoints; i++) {
        const percent = (i === numPoints - 1) ? 1 : i / (numPoints - 1);
        let totalLat = 0;
        let totalLng = 0;
        let pointsFound = 0;

        for (let j = 0; j < paths.length; j++) {
            const path = paths[j];
            if (path.length === 0) continue;

            const targetDist = totalDistances[j] * percent;
            const point = getPointAtDistance(path, targetDist);
            if (point) {
                totalLat += point.lat;
                totalLng += point.lng;
                pointsFound++;
            }
        }

        if (pointsFound > 0) {
            averagePath.push({ lat: totalLat / pointsFound, lng: totalLng / pointsFound });
        }
    }
    console.log("Calculated average path:", averagePath);
    return averagePath;
}

function getPointAtDistance(path, targetDistance) {
    if (targetDistance <= 0) return path[0];
    let distanceCovered = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const segmentDistance = haversineDistance(p1, p2);
        if (distanceCovered + segmentDistance >= targetDistance) {
            const fraction = (segmentDistance === 0) ? 0 : (targetDistance - distanceCovered) / segmentDistance;
            const lat = p1.lat + (p2.lat - p1.lat) * fraction;
            const lng = p1.lng + (p2.lng - p1.lng) * fraction;
            return { lat, lng };
        }
        distanceCovered += segmentDistance;
    }
    return path[path.length - 1];
}

function getTotalDistance(path) {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        totalDistance += haversineDistance(path[i], path[i+1]);
    }
    return totalDistance;
}

function haversineDistance(p1, p2) {
    const R = 6371e3; // metres
    const phi1 = p1.lat * Math.PI/180;
    const phi2 = p2.lat * Math.PI/180;
    const deltaPhi = (p2.lat-p1.lat) * Math.PI/180;
    const deltaLambda = (p2.lng-p1.lng) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}
