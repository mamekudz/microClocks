#include "FlyClockEditorLibrary.h"

#include "Materials/Material.h"
#include "Materials/MaterialExpression.h"

bool UFlyClockEditorLibrary::ConnectWorldPositionOffset(UMaterial* Material, UMaterialExpression* Expression)
{
#if WITH_EDITORONLY_DATA
	if (!Material || !Expression) return false;
	Material->GetEditorOnlyData()->WorldPositionOffset.Connect(0, Expression);
	return true;
#else
	return false;
#endif
}
