import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import mapStyles from "@/lib/mapStyles";


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
      

      {/* Google Map */}
      <div ref={mapRef} className="h-full w-full" style={{ zIndex: 0 }} />
    </div>
  );
}