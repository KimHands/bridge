from app.services.routine_selector import pick_track


def test_low_energy_only_picks_minimal():
    assert pick_track(["무기력한"]) == "minimal"
    assert pick_track(["우울한", "무기력한"]) == "minimal"


def test_mixed_picks_keyword():
    assert pick_track(["무기력한", "짜증나는"]) == "keyword"


def test_empty_picks_fallback():
    assert pick_track([]) == "fallback"
