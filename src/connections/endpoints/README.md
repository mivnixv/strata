# Fading connection endpoints

A connection dimmed by an overlapping upper route retains a bright start and
arrowhead in the idle view. Each endpoint fades into the 10%-opacity body over
up to 25.6 diagram units, following bends. On short routes each fade is limited
to half the total length.

The line body and labels are dimmed independently of the endpoint overlays, so
parent opacity cannot hide the bright ends. Hover reveals every direct incoming
and outgoing connection at full opacity, even across overlaps. Moving away
restores coverage and fading endpoints. While an item is selected, hover changes
are disabled, including for isolated selected items. Connections related to the selected resource remain
fully visible; unrelated connections retain selection dimming.

Dashed endpoint strokes keep the same dash pattern and phase as the complete
route. SVG and standalone HTML exports retain the gradients.
