# Connection ports

Connections choose facing resource sides automatically:

- Horizontally adjacent resources use left/right ports.
- Vertically separated resources with overlapping horizontal spans use bottom/top
  ports. Overlap must leave room for a 12-unit inset on each side.
- Overlapping spans align ports into a straight line when it is clear of other
  resources and reserved endpoints. Obstacles still cause a routed detour.
- Offset vertical ports and vertical detours can use slanted middle segments,
  matching horizontal connections. Terminal segments retain their attachment
  direction. Diagonals keep 12 units of obstacle clearance; tight detours remain
  orthogonal when a safe diagonal is unavailable.
  Bend endpoints may shift independently when nearby items leave uneven space.

Expanded containers expose their 44-unit header as the connection surface;
collapsed containers expose the full card. Incoming and outgoing collapsed
trunks stay separate on each side. Parallel edges and fan-in/fan-out use distinct
ports ordered by their neighbours' position along the attachment side.

The router reserves both horizontal and vertical terminal stubs before routing
any edge. Middle labels remain horizontal beside vertical route segments;
endpoint symbols automatically follow the segment direction. Scene bounds
include label boxes so vertical labels remain within SVG and HTML exports.

`ConnectionPorts` is injected into `OrthogonalRouter` for port selection and
alignment. Run `node --test src/connections/ports/ports.test.js` for vertical,
parallel, collapsed, obstacle, label, endpoint, and offline bundle coverage.
