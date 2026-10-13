import React from 'react';

interface CoordinateHudProps {
  selectedExpressID: number | null;
  transformInfo: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
  elementCount: number;
  isTreeOpen?: boolean;
  treeWidth?: number;
}

export const CoordinateHud: React.FC<CoordinateHudProps> = ({
  selectedExpressID,
  transformInfo,
  elementCount
}) => {
  const formatCoord = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(3)}m`;
  };

  return (
    <div
      data-qa="coordinate-hud"
      className="sr-only"
      aria-hidden="true"
    >
      <span>{elementCount} meshes</span>
      {selectedExpressID !== null && (
        <span>
          #{selectedExpressID} X {transformInfo ? formatCoord(transformInfo.position[0]) : '+0.000m'} Y {transformInfo ? formatCoord(transformInfo.position[1]) : '+0.000m'} Z {transformInfo ? formatCoord(transformInfo.position[2]) : '+0.000m'}
        </span>
      )}
    </div>
  );
};

