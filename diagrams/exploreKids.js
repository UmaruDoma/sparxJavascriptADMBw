!INC Local Scripts.EAConstants-JScript

/* umarudoma, cndrbrbr 2026
 * EA Diagram Script:
 * - Rekursiv Kinder eines selektierten Elements in das aktuelle Diagramm einfügen
 * - Elemente sichtbar machen
 * - Parent und Nachbarelemente bzgl. Position/Größe anpassen
 *
 * Einsatz:
 *   Script Group Type = Diagram Group
 *   Dann im Diagramm per Rechtsklick starten.
 */

var CFG = {
    startXOffset: 220,     // Abstand Kinder rechts vom Parent
    levelXOffset: 220,     // zusätzlicher Abstand je Rekursionsebene
    startYOffset: 0,
    verticalGap: 30,       // Abstand zwischen Geschwistern
    defaultWidth: 140,
    defaultHeight: 60,
    minParentWidth: 170,
    minParentHeight: 70,
    padding: 20,
    overlapGap: 30,        // Mindestabstand bei Kollisionen
    maxDepth: 50
};

function main()
{
    var diagram = Repository.GetCurrentDiagram();
    if (!diagram) {
        Session.Prompt("Kein aktives Diagramm geöffnet.", promptOK);
        return;
    }

    var ctxType = Repository.GetContextItemType();
    if (ctxType != otElement) {
        Session.Prompt("Bitte genau ein Diagrammelement selektieren und das Script erneut starten.", promptOK);
        return;
    }

    var rootElement = Repository.GetContextObject();
    if (!rootElement) {
        Session.Prompt("Kein Element im Kontext gefunden.", promptOK);
        return;
    }

    Repository.SaveDiagram(diagram.DiagramID);

    var visited = new ActiveXObject("Scripting.Dictionary");
    var rootDO = ensureDiagramObject(diagram, rootElement, 50, -50, CFG.defaultWidth, CFG.defaultHeight);

    // Wurzel normalisieren
    normalizeDiagramObject(rootDO, CFG.minParentWidth, CFG.minParentHeight);

    layoutChildrenRecursive(diagram, rootElement, rootDO, 0, visited);

    diagram.Update();
    Repository.ReloadDiagram(diagram.DiagramID);

    Session.Output("Fertig: Kinder rekursiv eingefügt und Layout angepasst für " + rootElement.Name);
}

/**
 * Rekursives Layout:
 * - holt Kinder des parentElement
 * - fügt sie rechts vom Parent ein
 * - passt Parent-Höhe an
 * - verschiebt Nachbarn bei Überlappung
 */
function layoutChildrenRecursive(diagram, parentElement, parentDO, depth, visited)
{
    if (depth > CFG.maxDepth) {
        Session.Output("Maximale Rekursionstiefe erreicht bei: " + parentElement.Name);
        return;
    }

    if (visited.Exists(parentElement.ElementGUID)) {
        return;
    }
    visited.Add(parentElement.ElementGUID, true);

    var children = getChildElements(parentElement);
    if (children.length == 0) {
        return;
    }

    var parentLeft   = parseInt(parentDO.left, 10);
    var parentRight  = parseInt(parentDO.right, 10);
    var parentTop    = parseInt(parentDO.top, 10);
    var parentBottom = parseInt(parentDO.bottom, 10);

    var childX = parentRight + CFG.startXOffset + (depth * CFG.levelXOffset);
    var cursorTop = parentTop + CFG.startYOffset;

    var placedChildren = [];

    for (var i = 0; i < children.length; i++) {
        var child = children[i];

        var childDO = findDiagramObject(diagram, child.ElementID);
        if (!childDO) {
            childDO = ensureDiagramObject(
                diagram,
                child,
                childX,
                cursorTop,
                CFG.defaultWidth,
                CFG.defaultHeight
            );
        } else {
            normalizeDiagramObject(childDO, CFG.defaultWidth, CFG.defaultHeight);
            // Falls schon vorhanden: nach rechts ziehen, wenn es links/zu nah liegt
            if (parseInt(childDO.left, 10) < childX) {
                moveDiagramObject(childDO, childX, parseInt(childDO.top, 10));
            }
        }

        resolveOverlaps(diagram, childDO, child.ElementID);

        placedChildren.push(childDO);

        // Rekursion
        layoutChildrenRecursive(diagram, child, childDO, depth + 1, visited);

        cursorTop = parseInt(childDO.bottom, 10) + CFG.verticalGap;
    }

    resizeParentToChildren(parentDO, placedChildren);
    resolveOverlaps(diagram, parentDO, parentElement.ElementID);
}

/**
 * Liefert untergeordnete Elemente.
 * Für klassische Browser-Kinder: element.Elements
 */
function getChildElements(element)
{
    var result = [];

    // "normale" Unterelemente
    for (var i = 0; i < element.Elements.Count; i++) {
        var child = element.Elements.GetAt(i);
        result.push(child);
    }

    return result;
}

function ensureDiagramObject(diagram, element, left, top, width, height)
{
    var existing = findDiagramObject(diagram, element.ElementID);
    if (existing) {
        return existing;
    }

    var right = left + width;
    var bottom = top - height; // EA-Koordinaten: bottom oft negativer als top

    var pos = "l=" + left + ";r=" + right + ";t=" + top + ";b=" + bottom + ";";
    var dObj = diagram.DiagramObjects.AddNew(pos, "");
    dObj.ElementID = element.ElementID;
    dObj.Update();

    return dObj;
}

function findDiagramObject(diagram, elementID)
{
    for (var i = 0; i < diagram.DiagramObjects.Count; i++) {
        var dObj = diagram.DiagramObjects.GetAt(i);
        if (dObj.ElementID == elementID) {
            return dObj;
        }
    }
    return null;
}

function normalizeDiagramObject(dObj, minWidth, minHeight)
{
    var left   = parseInt(dObj.left, 10);
    var right  = parseInt(dObj.right, 10);
    var top    = parseInt(dObj.top, 10);
    var bottom = parseInt(dObj.bottom, 10);

    var width = right - left;
    var height = Math.abs(top - bottom);

    if (width < minWidth) {
        right = left + minWidth;
    }

    if (height < minHeight) {
        bottom = top - minHeight;
    }

    dObj.left = left;
    dObj.right = right;
    dObj.top = top;
    dObj.bottom = bottom;
    dObj.Update();
}

function moveDiagramObject(dObj, newLeft, newTop)
{
    var width = parseInt(dObj.right, 10) - parseInt(dObj.left, 10);
    var height = Math.abs(parseInt(dObj.top, 10) - parseInt(dObj.bottom, 10));

    dObj.left = newLeft;
    dObj.right = newLeft + width;
    dObj.top = newTop;
    dObj.bottom = newTop - height;
    dObj.Update();
}

function resizeParentToChildren(parentDO, childDOs)
{
    if (childDOs.length == 0) {
        return;
    }

    var left   = parseInt(parentDO.left, 10);
    var right  = parseInt(parentDO.right, 10);
    var top    = parseInt(parentDO.top, 10);
    var bottom = parseInt(parentDO.bottom, 10);

    var minTop = top;
    var maxBottom = bottom;

    for (var i = 0; i < childDOs.length; i++) {
        var c = childDOs[i];
        var cTop = parseInt(c.top, 10);
        var cBottom = parseInt(c.bottom, 10);

        if (cTop > minTop) minTop = cTop;
        if (cBottom < maxBottom) maxBottom = cBottom;
    }

    var desiredTop = Math.max(top, minTop + CFG.padding);
    var desiredBottom = Math.min(bottom, maxBottom - CFG.padding);

    // Wenn Children höher sind als Parent: Parent strecken
    if (desiredTop != top || desiredBottom != bottom) {
        parentDO.top = desiredTop;
        parentDO.bottom = desiredBottom;
    }

    // Mindestbreite
    if ((right - left) < CFG.minParentWidth) {
        parentDO.right = left + CFG.minParentWidth;
    }

    // Mindesthöhe
    if (Math.abs(parseInt(parentDO.top, 10) - parseInt(parentDO.bottom, 10)) < CFG.minParentHeight) {
        parentDO.bottom = parseInt(parentDO.top, 10) - CFG.minParentHeight;
    }

    parentDO.Update();
}

/**
 * Verschiebt alle Nachbarn, die das Zielobjekt überlappen.
 * Einfache Kollisionslogik: überlappende Objekte nach rechts schieben.
 */
function resolveOverlaps(diagram, targetDO, excludeElementID)
{
    var changed = true;
    var safety = 0;

    while (changed && safety < 100) {
        changed = false;
        safety++;

        for (var i = 0; i < diagram.DiagramObjects.Count; i++) {
            var other = diagram.DiagramObjects.GetAt(i);

            if (other.ElementID == excludeElementID) {
                continue;
            }
            if (sameDiagramObject(targetDO, other)) {
                continue;
            }

            if (intersects(targetDO, other, CFG.overlapGap)) {
                var shift = computeHorizontalShift(targetDO, other, CFG.overlapGap);
                other.left = parseInt(other.left, 10) + shift;
                other.right = parseInt(other.right, 10) + shift;
                other.Update();
                changed = true;
            }
        }
    }
}

function sameDiagramObject(a, b)
{
    return (
        parseInt(a.ElementID, 10) == parseInt(b.ElementID, 10) &&
        parseInt(a.left, 10) == parseInt(b.left, 10) &&
        parseInt(a.right, 10) == parseInt(b.right, 10) &&
        parseInt(a.top, 10) == parseInt(b.top, 10) &&
        parseInt(a.bottom, 10) == parseInt(b.bottom, 10)
    );
}

function intersects(a, b, gap)
{
    var aL = parseInt(a.left, 10) - gap;
    var aR = parseInt(a.right, 10) + gap;
    var aT = parseInt(a.top, 10) + gap;
    var aB = parseInt(a.bottom, 10) - gap;

    var bL = parseInt(b.left, 10);
    var bR = parseInt(b.right, 10);
    var bT = parseInt(b.top, 10);
    var bB = parseInt(b.bottom, 10);

    var horizontal = !(aR < bL || aL > bR);
    var vertical   = !(aB > bT || aT < bB);

    return horizontal && vertical;
}

function computeHorizontalShift(anchor, other, gap)
{
    var anchorRight = parseInt(anchor.right, 10);
    var otherLeft = parseInt(other.left, 10);

    return (anchorRight - otherLeft) + gap;
}

main();
