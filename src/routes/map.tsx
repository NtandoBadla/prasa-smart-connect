import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const mapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d8f0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a90d9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#4a4a4a" }] },
  { featureType: "transit.station.rail", elementType: "labels.icon", stylers: [{ color: "#0000ff" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
];


export const Route = createFileRoute("/map")({
  component: MapPage,
  
});

function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMap = async () => {
      if (!window.google) {
        const script = document.createElement("script");

        script.src = `https://maps.googleapis.com/maps/api/js?key=${
          import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        }&libraries=places`;

        script.async = true;
        script.defer = true;

        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const map = new window.google.maps.Map(mapRef.current!, {
        center: { lat: -33.9249, lng: 18.4241 },
        zoom: 11,
        mapTypeControl: false,
        styles: mapStyles,
      });

      // Transit / railway layer
      const transitLayer = new window.google.maps.TransitLayer();
      transitLayer.setMap(map);

      // Search box
      // const input = document.getElementById(
      //   "place-autocomplete"
      // ) as HTMLInputElement;

      // const autocomplete =
      //   new window.google.maps.places.Autocomplete(input, {
      //     types: ["geocode", "establishment"],
      //     componentRestrictions: { country: "za" },
      //   });

      // const marker = new window.google.maps.Marker({
      //   map,
      // });

      // const infoWindow = new window.google.maps.InfoWindow();

      // autocomplete.addListener("place_changed", () => {
      //   const place = autocomplete.getPlace();

      //   if (!place.geometry || !place.geometry.location) return;

      //   map.setCenter(place.geometry.location);
      //   map.setZoom(15);

      //   marker.setPosition(place.geometry.location);

      //   infoWindow.setContent(`
      //     <div>
      //       <strong>${place.name}</strong>
      //       <p>${place.formatted_address || ""}</p>
      //     </div>
      //   `);

      //   infoWindow.open(map, marker);
      // });
    };

    loadMap();
  }, []);

  return (
    <div className="relative h-screen w-full">
      {/* Search Controls */}
      

      {/* Google Map */}
      <div ref={mapRef} className="h-full w-full" style={{ zIndex: 0 }} />
    </div>
  );
}