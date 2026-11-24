---- MODULE Notifications ----
CONSTANTS ToggleOff, ToggleOn, ResetOff, ResetOn
VARIABLE enabled

Init == enabled = FALSE

ToggleResult(value) == ~value
ResetResult(value) == FALSE

Toggle == enabled' = ToggleResult(enabled)
Reset == enabled' = ResetResult(enabled)
Next == Toggle \/ Reset

TypeOK == enabled \in BOOLEAN

ImplementationAgrees ==
    /\ ToggleOff = ToggleResult(FALSE)
    /\ ToggleOn = ToggleResult(TRUE)
    /\ ResetOff = ResetResult(FALSE)
    /\ ResetOn = ResetResult(TRUE)
====
