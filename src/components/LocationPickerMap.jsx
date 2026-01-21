import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon not displaying correctly in some bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const PHILIPPINES_CENTER = [12.8797, 121.7740];
const DEFAULT_ZOOM = 6;

function DraggableMarker({ position, setPosition, onLocationSelect, disabled }) {
    const markerRef = useRef(null);

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const newPos = marker.getLatLng();
                    setPosition(newPos);
                    onLocationSelect(newPos.lat, newPos.lng);
                }
            },
        }),
        [onLocationSelect, setPosition],
    );

    return (
        <Marker
            draggable={!disabled}
            eventHandlers={disabled ? {} : eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

function MapEvents({ setPosition, onLocationSelect, disabled }) {
    useMapEvents({
        click(e) {
            if (!disabled) {
                setPosition(e.latlng);
                onLocationSelect(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

// COMPONENT: Auto-center map when position changes
function RecenterAutomatically({ position }) {
    const map = useMap();
    useEffect(() => {
        // Normalize: supports {lat, lng} object or [lat, lng] array
        const lat = position.lat || position[0];
        const lng = position.lng || position[1];

        // Check if valid and NOT the default center
        if (lat && lng && (lat !== PHILIPPINES_CENTER[0] || lng !== PHILIPPINES_CENTER[1])) {
            map.flyTo([lat, lng], 18, {
                animate: true,
                duration: 1.5
            });
        }
    }, [position, map]);
    return null;
}

const LocationPickerMap = ({ latitude, longitude, onLocationSelect, disabled = false }) => {
    // Initial position state
    const [position, setPosition] = useState(PHILIPPINES_CENTER);

    // Sync internal state with props when they change (validating they exist)
    useEffect(() => {
        if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
            setPosition({ lat: parseFloat(latitude), lng: parseFloat(longitude) });
        }
    }, [latitude, longitude]);

    return (
        <div className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
            {/* Map */}
            <MapContainer
                center={position.lat ? position : PHILIPPINES_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Click Listener */}
                <MapEvents setPosition={setPosition} onLocationSelect={onLocationSelect} disabled={disabled} />

                {/* Auto Zoom */}
                <RecenterAutomatically position={position} />

                {/* Marker */}
                <DraggableMarker
                    position={position}
                    setPosition={setPosition}
                    onLocationSelect={onLocationSelect}
                    disabled={disabled}
                />
            </MapContainer>

            {disabled && (
                <div className="absolute inset-0 bg-gray-100/50 z-[1000] flex items-center justify-center cursor-not-allowed">
                    <span className="bg-white/80 px-4 py-2 rounded-full font-bold text-gray-500 shadow-sm backdrop-blur-sm">
                        Map Interaction Disabled
                    </span>
                </div>
            )}
        </div>
    );
};

export default LocationPickerMap;
