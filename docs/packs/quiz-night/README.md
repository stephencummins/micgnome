# QUIZ NIGHT

Four sounds for hosting a quiz. The white button picks one and the grey button plays it.

| Slot | Sound | duck | While it plays |
|---|---|---|---|
| 0 | chime (ding-dong) | 1.0 | your voice is cut, so it lands clean |
| 1 | applause | 0.5 | your voice is halved; keep talking |
| 2 | walk-on sting | 0.5 | halved; `startstop`, so press again to stop it |
| 3 | wrong-answer buzzer | 1.0 | cut |

The orange button's first two slots are HOST (clean, a little presence) and TANNOY (a horn speaker for
announcements). Both put SAMPLE last, so the sounds play dry whatever the voice is doing.

Load it: plug the mic in, copy `config.json` and the four wavs to the top level of its disk
(replacing what is there). If you deleted old files, empty the bin before ejecting: until you do,
they still use the mic's 1 MB and it says there is not enough space. Then eject. Needs firmware 1.0.9 or later for `duck`; flash 1.1.2.

Every sound is synthesised by `make_sounds.py` (numpy), so nothing here is anyone's recording.
24 kHz, 16-bit mono: about 800 KB of the mic's 1 MB.

Not yet heard on hardware: whether the mic plays a 24 kHz wav at the right speed (the duck test
used 48 kHz), and whether `startstop` loops. The walk-on ends on its own either way.
