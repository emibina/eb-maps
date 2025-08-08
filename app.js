let map;
let lapPolylines = []; // Array to store lap polylines
let averageLinePolyline = null; // To store the average line polyline
let allLapPaths = []; // To store the paths of all original laps
let leftBorderPolyline = null;
let rightBorderPolyline = null;

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

    const exportBtn = document.getElementById('export-driven-line-btn');
    exportBtn.addEventListener('click', handleExportDrivenLine);

    const computeBordersBtn = document.getElementById('compute-borders-btn');
    computeBordersBtn.addEventListener('click', handleComputeBorders);
}

function handleFileUpload(event) {
    clearLaps();

    const files = event.target.files;
    if (!files.length) {
        return;
    }

    let filesRead = 0;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const kmlContent = e.target.result;
            const coordinates = parseKML(kmlContent);
            if (coordinates.length > 0) {
                drawLap(coordinates);
                allLapPaths.push(coordinates);
            }

            filesRead++;
            if (filesRead === files.length && allLapPaths.length > 0) {
                fitMapToLaps(allLapPaths);
                const averagePath = calculateAverageLine(allLapPaths);
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
    document.getElementById('export-driven-line-btn').disabled = false;
    document.getElementById('compute-borders-btn').disabled = false;
}

function drawTrackBorders({ leftBorder, rightBorder }) {
    const borderOptions = {
        geodesic: true,
        strokeColor: '#333333', // Dark grey
        strokeOpacity: 0.9,
        strokeWeight: 2,
    };

    leftBorderPolyline = new google.maps.Polyline({
        ...borderOptions,
        path: leftBorder,
    });

    rightBorderPolyline = new google.maps.Polyline({
        ...borderOptions,
        path: rightBorder,
    });

    leftBorderPolyline.setMap(map);
    rightBorderPolyline.setMap(map);
}

function toggleEditMode() {
    if (!averageLinePolyline) return;

    const isEditable = averageLinePolyline.getEditable();
    averageLinePolyline.setEditable(!isEditable);

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

    if (!isDraggable) {
        if (averageLinePolyline.getEditable()) {
            averageLinePolyline.setEditable(false);
            document.getElementById('toggle-edit-btn').textContent = 'Toggle Edit Mode';
        }
    }

    document.getElementById('toggle-move-btn').textContent = !isDraggable ? 'Finish Moving' : 'Move Line';
}

function handleExportDrivenLine() {
    if (!averageLinePolyline) {
        alert("There is no average line to export.");
        return;
    }

    const path = averageLinePolyline.getPath().getArray();
    const plainPath = path.map(latLng => ({ lat: latLng.lat(), lng: latLng.lng() }));

    if (plainPath.length === 0) {
        alert("The average line is empty.");
        return;
    }

    const kmlContent = generateKML(plainPath);
    downloadFile(kmlContent, 'driven-line.kml', 'application/vnd.google-earth.kml+xml');
}

function handleComputeBorders() {
    if (!averageLinePolyline || allLapPaths.length === 0) {
        alert("Please load KML lap data and ensure an average line is present.");
        return;
    }

    if (leftBorderPolyline) leftBorderPolyline.setMap(null);
    if (rightBorderPolyline) rightBorderPolyline.setMap(null);

    console.log("Computing track borders...");
    const averagePath = averageLinePolyline.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));

    const { leftBorder, rightBorder } = computeTrackBorders(averagePath);

    if (leftBorder.length > 0 && rightBorder.length > 0) {
        drawTrackBorders({ leftBorder, rightBorder });
        console.log("Track borders drawn.");
    } else {
        console.error("Failed to compute track borders.");
    }
}

function clearLaps() {
    for (let i = 0; i < lapPolylines.length; i++) {
        lapPolylines[i].setMap(null);
    }
    lapPolylines = [];
    allLapPaths = []; // Clear stored paths

    if (averageLinePolyline) {
        averageLinePolyline.setMap(null);
        averageLinePolyline = null;
    }

    if (leftBorderPolyline) {
        leftBorderPolyline.setMap(null);
        leftBorderPolyline = null;
    }
    if (rightBorderPolyline) {
        rightBorderPolyline.setMap(null);
        rightBorderPolyline = null;
    }

    const toggleEditBtn = document.getElementById('toggle-edit-btn');
    toggleEditBtn.disabled = true;
    toggleEditBtn.textContent = 'Toggle Edit Mode';

    const toggleMoveBtn = document.getElementById('toggle-move-btn');
    toggleMoveBtn.disabled = true;
    toggleMoveBtn.textContent = 'Move Line';

    document.getElementById('export-driven-line-btn').disabled = true;

    document.getElementById('compute-borders-btn').disabled = true;
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

function generateKML(path) {
    const coordinateString = path.map(p => `${p.lng},${p.lat},0`).join('\n          ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Average Driven Line</name>
      <LineString>
        <coordinates>
          ${coordinateString}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================
// Track Border Calculation
// =============================================

function computeTrackBorders(averagePath) {
    if (!google.maps.geometry) {
        console.error("Google Maps Geometry library not loaded.");
        return { leftBorder: [], rightBorder: [] };
    }
    if (!averagePath || averagePath.length < 2) {
        return { leftBorder: [], rightBorder: [] };
    }

    const leftBorder = [];
    const rightBorder = [];
    const offset = 10; // 10 meters

    for (let i = 0; i < averagePath.length; i++) {
        const currentPoint = new google.maps.LatLng(averagePath[i]);
        let heading;

        if (i === 0) {
            // For the first point, use the heading of the first segment
            heading = google.maps.geometry.spherical.computeHeading(currentPoint, new google.maps.LatLng(averagePath[i + 1]));
        } else {
            // For other points, use the heading from the previous point to the current one
            heading = google.maps.geometry.spherical.computeHeading(new google.maps.LatLng(averagePath[i - 1]), currentPoint);
        }

        // Calculate points 10m to the left and right
        // Note: A heading of -90 is left, +90 is right.
        const leftPoint = google.maps.geometry.spherical.computeOffset(currentPoint, offset, heading - 90);
        const rightPoint = google.maps.geometry.spherical.computeOffset(currentPoint, offset, heading + 90);

        leftBorder.push(leftPoint);
        rightBorder.push(rightPoint);
    }

    return { leftBorder, rightBorder };
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
