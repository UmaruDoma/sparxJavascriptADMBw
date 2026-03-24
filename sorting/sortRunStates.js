!INC Local Scripts.EAConstants-JScript

/*
 * This code has been included from the default Project Browser template.
 * If you wish to modify this template, it is located in the Config\Script Templates
 * directory of your EA install path.   
 * 
 * Script Name: sortRunStates
 * Author: cndrbrbr
 * Purpose: Sort the Runstates of an Instance in Sparx
 * Date: 10.03.2023
 */

/*
 * Project Browser Script main function
 */
function OnProjectBrowserScript()
{
	// Get the type of element selected in the Project Browser
	var treeSelectedType = Repository.GetTreeSelectedItemType();
	
	// Handling Code: Uncomment any types you wish this script to support
	// NOTE: You can toggle comments on multiple lines that are currently
	// selected with [CTRL]+[SHIFT]+[C].
	switch ( treeSelectedType )
	{
		case otElement :
		{
			// Code for when an element is selected
			var element as EA.Element;
		
			element = Repository.GetTreeSelectedObject();
    
			if (element.RunState == "")
			{
				Session.Prompt("Keine RunStates vorhanden.", promptOK);
				return;
			}

			// RunState String holen
			var runstate = element.RunState;

			// Zerlegen
			var states = runstate.split("@ENDVAR;");

			var list = [];

			for (var i = 0; i < states.length; i++)
			{
				if (states[i] == "") continue;

				var nameMatch = states[i].match(/@VAR;Variable=(.*?);/);

				if (nameMatch)
				{
					list.push({
						name: nameMatch[1],
						raw: states[i]
					});
				}
			}

			// alphabetisch sortieren
			list.sort(function(a, b)
			{
				return a.name.localeCompare(b.name);
			});

			// neu zusammensetzen
			var newRunState = "";

			for (var j = 0; j < list.length; j++)
			{
				newRunState += list[j].raw + "@ENDVAR;";
			}

			element.RunState = newRunState;
			element.Update();

			Repository.RefreshOpenDiagrams(true);			
			break;
		}
//		case otPackage :
//		{
//			// Code for when a package is selected
//			var thePackage as EA.Package;
//			thePackage = Repository.GetTreeSelectedObject();
//			
//			break;
//		}
//		case otDiagram :
//		{
//			// Code for when a diagram is selected
//			var theDiagram as EA.Diagram;
//			theDiagram = Repository.GetTreeSelectedObject();
//			
//			break;
//		}
//		case otAttribute :
//		{
//			// Code for when an attribute is selected
//			var theAttribute as EA.Attribute;
//			theAttribute = Repository.GetTreeSelectedObject();
//			
//			break;
//		}
//		case otMethod :
//		{
//			// Code for when a method is selected
//			var theMethod as EA.Method;
//			theMethod = Repository.GetTreeSelectedObject();
//			
//			break;
//		}
		default:
		{
			// Error message
			Session.Prompt( "This script does not support items of this type.", promptOK );
		}
	}
}

OnProjectBrowserScript();
