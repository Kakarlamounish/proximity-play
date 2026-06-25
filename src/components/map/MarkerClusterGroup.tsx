import { createPathComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function createMarkerClusterGroup(props: any, context: any) {
  const markerClusterGroup = (L as any).markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (cluster: any) => {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `
          <div style="position:relative;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5)); display: flex; align-items: center; justify-content: center;">
            <div style="width:52px;height:52px;border-radius:50%;border:3px solid #fff;background:linear-gradient(135deg,#FFFC00,#FF6B00);display:flex;align-items:center;justify-content:center;color:#1a1a2e;font-weight:900;font-size:22px;box-shadow:inset 0 -2px 4px rgba(0,0,0,0.2)">
              +${count}
            </div>
            <div style="position:absolute;bottom:-6px;right:-4px;width:16px;height:16px;background:#00E676;border-radius:50%;border:2.5px solid #1a1a2e;z-index:2"></div>
          </div>
        `,
        className: 'custom-cluster-icon',
        iconSize: L.point(52, 52),
      });
    },
    ...props
  });

  return {
    instance: markerClusterGroup,
    context: { ...context, layerContainer: markerClusterGroup }
  };
}

export const MarkerClusterGroup = createPathComponent(createMarkerClusterGroup);
