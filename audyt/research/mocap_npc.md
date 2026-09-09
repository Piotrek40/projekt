# Mocap dla NPC na rynku — wybor, normalizacja, inwentarz, licencje

Etap 4, jeden NPC (naga figura ludzka) stojacy i chodzacy po placu.
Skrypt: `assets_blender/npc_mocap.py`. Wszystkie liczby ponizej pochodza z komend
wypisanych przy kazdej sekcji — nie z dokumentacji zrodla ani z nazw plikow.


> ## ⚠ SPROSTOWANIE — czesc liczb w tym dokumencie opisuje INNY przebieg niz wyslany klip
>
> Weryfikator adwersaryjny (2026-09-09) uruchomil wlasne komendy na wyslanych plikach i wykazal, ze:
>
> 1. **Lista „trzech warunkow weryfikacji naprawy szwu" (sekcja z linia 297) dotyczy przebiegu K = 12,
>    a do gry poszedl K = 22.** Zmierzone: `max |cycle_fixed.npy − Male1_walk_cycle.bvh| = 2,7264°`
>    (`Neck.Zrotation`, klatka 23), rozne 64 z 69 kanalow. Poprawne liczby dla WYSLANEGO klipu to
>    warunek (2) **+8,1 %** (`RightShoulder`, 0,859° → 0,929°), nie +4,2 % na `Hips`,
>    oraz warunek (3) **L 2,60 → 2,90 cm, P 1,96 → 2,09 cm**, nie „L 2,60 → 2,60".
>    Wyslany klip nadal miesci sie w obu kryteriach (+8,1 % < +10 %, przyrost poslizgu 0,30 cm < 1 cm) —
>    to blad opisu, nie artefaktu.
> 2. **Poslizg stopy wyslanego cyklu to 2,90 cm (L) / 2,09 cm (P)**, a nie 2,60 / 2,09 — poprawka dotyczy
>    takze zdania w sekcji „Nie ma korekty poslizgu stopy".
> 3. **`loopverify2.py` wypisuje `ROZNICA poslizgu ... max 1.01 cm (kryterium: <1 cm)` i NIE wypisuje przy
>    tym zadnego OBLANE ani nie zwraca niezerowego kodu wyjscia.** Jedyna liczba lamiaca wlasne kryterium
>    przeszla wzrokiem. Do naprawy przed nastepnym uzyciem skryptu.
> 4. **`SkeletonUtils.retargetClip` NIE zadziala na tych plikach „z marszu"** — rzuca `TypeError`, bo mocap
>    GLB nie ma siatki, wiec nie ma `skin` i `scene.skeleton` jest `undefined`. Do tego **0 z 22 nazw stawow
>    ACCAD pokrywa sie z 53 koscmi `npc_body.glb`**. Retarget to osobne zadanie, nie „godzina na koniec".
> 5. **Miara szwu na zlaczach pomija `Hips` z zalozenia, a to `Hips` niesie nieciaglosc.** Z `Hips`:
>    zlacze `walk_cycle → walk_to_stand` daje **178,35°**. Zaden klip nie zaczyna sie w poczatku ukladu
>    (`Hips@t0` do (−2,472, 2,224)), a kursy sie rozjezdzaja (`walk_cycle` +133°, `walk_to_stand` −42°).
>    Sam `crossFadeTo` bedzie NPC obracal i teleportowal — korzen trzeba znormalizowac.
> 6. **Kolumna „max dQ" w dowodzie, ze optymalizacja nie zmienila ruchu, jest ponizej wlasnej podlogi szumu**
>    (0,0441° przy tym samym pliku wczytanym dwa razy). Wniosek broni sie wylacznie na kolumnie pozycji.
>
> Liczby w tabeli przemiatania K (ok. linii 279–286) sa poprawne — sprzecznosc dotyczy akapitow ponizej niej.

---

## 1. Inwentarz 299 plikow BVH

Wlasny parser BVH (bez `bpy` — skan 299 plikow trwa 3,2 s). Komenda:

```
python3 assets_blender/npc_mocap.py --scan     # -> npc_build/mocap/inwentarz.csv
```

| co | wynik |
|---|---|
| plikow BVH | 299 |
| sygnatura 22 kosci | **296 plikow** |
| sygnatura 21 kosci | **3 pliki**: `Male2_B24_WalkToCrouch`, `Male2_C19_RunToJumpToWalk`, `Male2_C20_RunToPickupBox` |
| roznica sygnatur | **`ToSpine`** — dokladnie ten joint brakuje w tych trzech |
| samokontrola (suma `CHANNELS` == liczba kolumn w `MOTION`) | 0 plikow niezgodnych |
| laczny czas | 1776,4 s |

**Ustalenie 296/3 i `ToSpine` — POTWIERDZONE.** Uscislenie: trzeci plik nazywa sie
`Male2_C20_RunToPickupBox.bvh` (nie `RunToPickup`).

### Nowe, czego wczesniej nie bylo w opisie zadania

**Zbior nie ma jednego fps.** Dwa `Frame Time`:

| Frame Time | fps | plikow |
|---|---|---|
| 0,0333333 | 30 | 286 |
| 0,00833333 | 120 | **13** |

Rozklad wg podmiotu (to jest kluczowe dla wyboru):

| podmiot | plikow | fps | kosci | laczny czas |
|---|---|---|---|---|
| Female1 | 81 | tylko 30 | tylko 22 | 650,6 s |
| **Male1** | **69** | **tylko 30** | **tylko 22** | 408,4 s |
| Male2 | 149 | **30 i 120 pomieszane** | **21 i 22 pomieszane** | 717,4 s |

Trzynascie plikow 120 fps to wylacznie Male2 (`A13`, `A14`, `A15`, `A2`, `A3`, `A4`,
`A5`, `A6`, `A7`, `B1`, `B2`, `B3`, `B4`). Male2 miesza wiec dwa fps **wewnatrz jednego
podmiotu** — `Male2_B1_StandToWalk` ma 120 fps, a `Male2_B10_WalkTurnLeft45` 30 fps.

### Kalibracja skanera (dowod, ze potrafi oblac)

Trzy uszkodzone kopie `Female1_A01_Stand.bvh`, kazda musiala zostac wykryta:

| co zepsute | co skaner zglosil | wynik |
|---|---|---|
| zmieniona nazwa jointa `ToSpine` | `'ToSpine' obecny = False`, sygnatura rozni sie od oryginalu | wykryte |
| `Frame Time` podmienione na 1/120 | czas 0,7500 s zamiast 3,0000 s | wykryte |
| usunieta 1 kolumna z kazdego wiersza `MOTION` | `CHANNELS=69`, kolumn=68, samokontrola `False` | wykryte |

---

## 2. Wybor podmiotu: Male1 — na podstawie antropometrii, nie na oko

```
python3 assets_blender/npc_mocap.py --anthro
```

Wzrost wyznaczony z **dlugosci segmentow**, nie z bboxa (bbox spoczynkowy jest
bezuzyteczny — patrz punkt 3). Trzy niezalezne estymaty wg proporcji Wintera
(*Biomechanics and Motor Control of Human Movement*): udo = 0,245·H, wysokosc
kretarza wiekszego = 0,530·H, podudzie = 0,246·H.

| podmiot | udo | podudzie | kretarz | H z uda | H z kretarza | H z podudzia | **rozrzut** | udo/H | kretarz/H |
|---|---|---|---|---|---|---|---|---|---|
| Female1 | 44,08 | 36,16 | 83,72 | 179,93 | 157,97 | 147,01 | **32,92 (20,4 %)** | 0,2727 | 0,5180 |
| **Male1** | 45,49 | 46,86 | 99,82 | 185,69 | 188,34 | 190,47 | **4,78 (2,5 %)** | **0,2418** | **0,5305** |
| Male2 | 42,88 | 42,84 | 92,21 | 175,00 | 173,97 | 174,16 | 1,03 (0,6 %) | 0,2459 | 0,5288 |

(jednostki BVH; cele: udo/H = 0,245, kretarz/H = 0,530)

**Female1 odpada na liczbach.** Jej udo/podudzie = 44,08/36,16 = **1,22**, podczas gdy
u czlowieka ten stosunek wynosi ok. 1,0 (Male1: 0,97, Male2: 1,00). Szkielet Female1
jest nieproporcjonalny — trzy estymaty wzrostu rozjezdzaja sie o 20 %. Katy stawow
zapisane wzgledem takiego szkieletu przenosza sie na poprawne cialo z bledem
ustawienia stopy.

**Male2 ma najlepsza antropometrie (0,6 %), ale przegrywa na spojnosci zbioru**:
miesza 30 i 120 fps, ma 3 pliki bez `ToSpine`, a jego serie D/E/G to w calosci sztuki
walki (`D1_StandToReady`, `E1_JabLeft`, `G2_FrontKick`) — nie repertuar mieszczanina.

**Wybrany: Male1.**
- rozrzut antropometryczny 2,5 %, udo/H = 0,2418 i kretarz/H = 0,5305 (cele 0,245 / 0,530),
- 69/69 plikow @ 30 fps, 69/69 z pelnymi 22 komi,
- wzrost 1,882 m przy `global_scale = 0.01`, czyli praktycznie tyle co cialo MPFB
  (1,856 m) — retarget bez skalowania (stosunek 0,986),
- ma caly zadany repertuar u jednego podmiotu: `A1_Stand`, `A2_Sway`, `A3_SwingArms`,
  `A4_LookAround`, `B1_StandToWalk`, `B2_WalkToStand`, `B3_Walk`, plus skrety `B9`–`B16`.

### Pulapka w liscie kandydatow z zadania

Podana lista kandydatow **miesza podmioty i milczaco to ukrywa**:
`D2_Wait` (38,53 s) i `D3_ConversationGestures` (50,70 s) istnieja **wylacznie dla
Female1**. U Male2 `D2` to `Male2_D2_WalkToReady` (4,37 s, postawa bojowa), a Male1 nie
ma serii D w ogole. Nazwy `A1_Stand` / `A4_LookAround` / `A3_SwingArms` naleza z kolei do
Male1/Male2 — Female1 uzywa `A01_Stand` / `A04_Look` / `A03_Swing`. Wziecie tej listy
doslownie daje NPC zlozonego z dwoch roznych cial.

---

## 3. `global_scale` — uzasadnienie pomiarem

**`global_scale = 0.01`**, bo jednostki BVH w ACCAD to centymetry.

Nie jest to przyjete na wiare: przy 0,01 trzy niezalezne estymaty antropometryczne
Male1 daja 1,857 / 1,883 / 1,905 m, a Male2 1,750 / 1,740 / 1,742 m — czyli wartosci
w zakresie ludzkiego wzrostu. Kazda inna skala wyprowadza je poza ten zakres.

**Potwierdzenie ostrzezenia o bboxie.** Najwyzsza *kosc* konczy sie znacznie ponizej
czubka czaszki. Zmierzone w three.js na wyeksportowanym GLB (`walk_cycle`, t = 0):

```
wysokosc wezla Head nad najnizszym wezlem stopy = 1,6485 m
```

wobec wzrostu antropometrycznego 1,882 m — czyli **joint `Head` siega 87,6 % wzrostu**.
Wyznaczanie wzrostu z pozycji kosci zanizyloby go o 23 cm. `End Site` glowy daje 1,880 m
(99,9 % wzrostu), ale `End Site` **nie jest kością** i nie ma go w wyeksportowanym GLB.

Uwaga do przyszlych zrodel: stala CMU 0,056444 jest udokumentowana wylacznie dla
ASF/AMC i tutaj nie ma zastosowania. Plik `READMEFIRST.txt` lezacy w `npc_research/`
to readme konwersji **CMU** Bruce'a Hahne (2010), nie ACCAD — nie zawiera licencji ACCAD.

---

## 4. Wybrane klipy

Nie brane z nazwy — kazdy przemierzony. Liczby na **faktycznie eksportowanym zakresie**:

| klip GLB | zrodlo (klatki BVH) | czas | fps | v_sr | v_max | droga korzenia | przem. | zakres yaw glowy | kontakt L | DS | lot | co to jest / do czego |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `idle_lookaround` | `Male1_A4_LookAround` (calosc) | 15,933 s | 30 | 0,01 | 0,03 | **0,20 m** | 0,02 m | **291°** | 1,00 | 1,00 | 0,00 | glowne idle; stoi w miejscu i rozglada sie po placu |
| `idle_sway` | `Male1_A2_Sway` (calosc) | 9,367 s | 30 | 0,08 | 0,19 | 0,73 m | 0,03 m | 59° | 1,00 | 1,00 | 0,00 | idle z przenoszeniem ciezaru; wariant do przeplatania |
| `idle_arms` | `Male1_A3_SwingArms` (calosc) | 5,733 s | 30 | 0,01 | 0,03 | **0,08 m** | **0,00 m** | 25° | 1,00 | 1,00 | 0,00 | idle krotkie, korzen **calkiem** nieruchomy (0 klatek z v > 0,15 m/s) |
| `walk_cycle` | `Male1_B3_Walk`, klatki **47–80** | **1,100 s** | 30 | 1,31 | 1,44 | 1,44 m | 1,44 m | 31° | 0,50 | 0,06 | 0,00 | jeden pelny cykl chodu, **domkniety w petle**; 1,310 m/s |
| `stand_to_walk` | `Male1_B1_StandToWalk`, klatki **45–172** | 4,233 s | 30 | 0,71 | 1,34 | 3,03 m | 3,00 m | 34° | 0,66 | 0,41 | 0,00 | wejscie w chod; ~1,07 s stania, ruszenie, konczy sie na kontakcie piety L przy 1,19 m/s |
| `walk_to_stand` | `Male1_B2_WalkToStand`, klatki **24–210** | 6,200 s | 30 | 0,87 | 1,49 | 5,42 m | 5,38 m | 38° | 0,66 | 0,30 | 0,00 | wyjscie z chodu; zaczyna na kontakcie piety L przy 1,19 m/s, konczy w bezruchu |

DS = udzial klatek z podwojnym podparciem, lot = udzial klatek bez kontaktu zadnej stopy.

### Odrzucone mimo obiecujacej nazwy

**`Male1_A1_Stand` — zanieczyszczony, NIE uzywac jako idle.** Nazwa obiecuje stanie,
ale w ostatnich 26 klatkach (5,37–6,20 s) postac **odchodzi z predkoscia 0,85 m/s**:

```
hip XZ: start=(0.14,-0.34) koniec=(-0.17,0.08) przem=0.519 m
klatki z |v|>0.15 m/s: 26  zakres 161..186 (5.37..6.20s)
|v| korzenia: pierwsze 5 kl [0.008 0.006 0. 0.003 0.009]  ostatnie 5 [0.808 0.825 0.851 0.769 0.668]
```

Zastapione przez `idle_arms` (droga korzenia 0,08 m, **zero** klatek powyzej 0,15 m/s).

### Detektor kontaktu stopy — kalibracja w obie strony

Kontakt = (pieta **lub** palec ponizej 9 % wzrostu) **i** (jego predkosc pozioma < 0,35 m/s).
Sprawdzony na klipach o znanej odpowiedzi:

| klip | oczekiwane | DS | lot | werdykt |
|---|---|---|---|---|
| `Male1_A1_Stand` | stoi | 0,898 | 0,000 | stoi — OK |
| `Male1_A3_SwingArms` | stoi | 1,000 | 0,000 | stoi — OK |
| `Male1_B3_Walk` | chod | 0,055 | 0,000 | chod — OK |
| `Male1_B1_StandToWalk` | chod | 0,378 | 0,000 | chod — OK |
| `Male1_C03_Run` | bieg | 0,000 | **0,674** | bieg — OK |
| `Male1_A13_Skipping` | bieg | 0,000 | **0,509** | bieg — OK |
| `Male1_A9_LieDown` | lezy | 1,000 | 0,000 | **stoi — ZLE** |

Ostatni wiersz zostawiam jako **znane ograniczenie**: detektor patrzy wylacznie na stopy,
wiec lezacego czlowieka klasyfikuje jak stojacego. Do wyboru klipow to nie przeszkadza
(nie bierzemy klipow lezenia), ale nie wolno go uzywac jako klasyfikatora postawy.

---

## 5. Cykl chodu — wyciecie i domkniecie petli

```
python3 assets_blender/npc_mocap.py --cycle
```

### Detekcja kontaktu piety, dwie niezalezne metody

- **Zeni et al. 2008** (metoda wspolrzednosciowa): kontakt piety = maksimum rzutu
  (stopa − miednica) na kierunek marszu.
- **z detekcji kontaktu**: poczatek kazdej ciaglej fazy podporu.

`Male1_B3_Walk` (183 kl @ 30 fps = 6,07 s):

```
Zeni      : [13, 47, 80, 114, 148]   (0.433, 1.567, 2.667, 3.800, 4.933 s)
kontaktowa: [16, 50, 84, 117, 151]   (0.533, 1.667, 2.800, 3.900, 5.033 s)
ZGODNOSC  : max rozjazd 133 ms, sredni 107 ms
```

Systematyczne przesuniecie o ~3 klatki jest oczekiwane: Zeni wskazuje moment
najdalszego wysuniecia stopy, detektor kontaktu — chwile, gdy stopa faktycznie
wyhamuje. Granice cyklu bierzemy z Zeniego (powtarzalne, niezalezne od progu).

### Prog domkniecia petli — i dlaczego akurat taki

Miara szwu: **kat geodezyjny** miedzy lokalnymi rotacjami stawu w klatce poczatkowej
i koncowej (`arccos((tr(RaᵀRb)−1)/2)`), odporny na zawijanie katow Eulera.

Prog: **p95 naturalnej zmiany klatka→klatka, osobno dla kazdego stawu.**
Uzasadnienie: szew, ktory nie przekracza typowego kroku miedzy dwiema *sasiednimi*
klatkami tego samego stawu, jest w odtwarzaniu nieodrozninalny od zwyklej klatki.
Progi rozpietaja sie od 1,05° (`RightShoulder`) do 16,39° (`LeftToeBase`) — dlatego
jeden wspolny prog bylby bez sensu.

### Cztery kandydaci na cykl w `Male1_B3_Walk`

| cykl | T | krok | v | szew max | najgorszy staw | stawow > progu | **stawow nog > progu** | szew w nogach |
|---|---|---|---|---|---|---|---|---|
| 13→47 | 1,133 s | 1,495 m | 1,32 m/s | 8,67° | `Spine1` | 8 | 0 | — |
| **47→80** | **1,100 s** | **1,441 m** | **1,31 m/s** | **6,29°** | `Neck` | **4** | **0** | **3,65°** |
| 80→114 | 1,133 s | 1,468 m | 1,30 m/s | 8,99° | `Neck` | 5 | 1 | 4,90° |
| 114→148 | 1,133 s | 1,453 m | 1,28 m/s | 5,37° | `Spine1` | 5 | 0 | — |

**Uczciwie: zaden cykl nie domyka sie sam z siebie.** Najlepszy (47→80) ma 4 stawy
powyzej progu — `Neck` 6,29° (prog 2,43°), `Head` 3,3° (2,59°) i dwa barki na styk
(1,2° vs 1,17° i 1,1° vs 1,05°). Winowajca jest **dryf glowy**: podmiot w trakcie
przejscia lekko odwraca glowe. **Nogi domykaja sie w pelni** — 0 stawow nog powyzej
progu, szew w nogach 3,65°.

Porownanie zrodel chodu tym samym kryterium:

| klip | najlepszy cykl | T | szew max | stawow > progu | **stawow nog > progu** |
|---|---|---|---|---|---|
| **`Male1_B3_Walk`** | **47→80** | 1,100 s | 6,29° | 4 | **0** |
| `Male1_B1_StandToWalk` | 206→241 | 1,167 s | 6,85° | 4 | 0 |
| `Male1_B2_WalkToStand` | 57→91 | 1,133 s | 9,31° | 5 | 0 |
| `Male2_B3_Walk` (120 fps) | 189→309 | 1,000 s | 4,30° | 10 | 4 |
| `Female1_B03_Walk1` | 53→91 | 1,267 s | 14,67° | 4 | 1 |
| `Male1_B15_WalkTurnAround` | 72→109 | 1,233 s | 11,47° | 7 | 0 |

### Kalibracja miary szwu (dowod, ze cokolwiek mierzy)

**(a) Przesuniecie konca cyklu.** Prawdziwy cykl musi dac minimum:

| przesuniecie k | szew max |
|---|---|
| −12 | 46,26° |
| −8 | 57,74° |
| −4 | 31,34° |
| −2 | 8,20° |
| **0 (wybrany)** | **6,29°** |
| +2 | 6,73° |
| +4 | 20,68° |
| +8 | 50,33° |
| +12 | 35,03° |

**(b) Pol-cykl** (kontakt piety L → kontakt piety **P**, nogi zamienione) — musi oblac:

```
13->30   szew 48,62°  stawow>progu 19/22
47->64   szew 52,58°  stawow>progu 20/22
80->97   szew 53,13°  stawow>progu 18/22
114->131 szew 55,02°  stawow>progu 18/22
```

**(c) Losowy odcinek** tej samej dlugosci, nie zaczepiony o kontakt piety: 8 prob,
szew 8,11°–44,29°, stawow powyzej progu 4–11. Zaden nie domyka sie lepiej niz 47→80.

### Naprawa szwu i jej weryfikacja

Reszta (6,29° na `Neck`) rozlozona po ostatnich **K = 22** klatkach cyklu wagą
smoothstep; kanaly `Xposition`/`Zposition` korzenia **wylaczone** z naprawy, bo krok
w przod ma zostac. K wybrane pomiarem — przemiatanie K i zakresu stawow:

| wariant | K | szew | poslizg L | poslizg P | przyrost zmiany kl→kl |
|---|---|---|---|---|---|
| surowy | — | 6,29° | 2,60 cm | 1,96 cm | — |
| cale cialo | 12 | 0,000° | 2,60 cm | 2,97 cm (**+1,01**) | +4,2 % |
| cale cialo | 16 | 0,000° | 2,60 cm | 2,53 cm | +9,0 % |
| **cale cialo** | **22** | **0,000°** | **2,90 cm (+0,30)** | **2,09 cm (+0,13)** | **+8,1 %** |
| cale cialo | 33 | 0,000° | 3,42 cm (+0,82) | 2,53 cm | +4,9 % |
| gora ciala | 22 | **3,649°** | 2,41 cm | 1,73 cm | +8,1 % |

Wybrane **K = 22, cale cialo**: petla domyka sie dokladnie, a poslizg stopy w podporze
rosnie o najwyzej **0,30 cm** (najmniej ze wszystkich wariantow). Wariant „gora ciala"
nie rusza nog wcale, ale zostawia szew 3,65° — odrzucony.

Trzy warunki, ktore naprawa musiala spelnic:

1. **szew = 0**: `max |F[B] − F[A]|` po kanalach rotacji i Y = **4,16·10⁻¹⁷**;
   szew geodezyjny 6,292° → **0,000°**.
2. **naprawa sama nie tworzy skoku**: najwiekszy wzrost maksymalnej zmiany
   klatka→klatka wsrod ruchomych stawow to **+4,2 %** (`Hips`, 2,656° → 2,768°);
   pozostale ≤ +0,4 % lub ujemne. Mediana naturalnego kroku 1,52°, szew 0 — ponizej.
3. **stopy nie zaczely slizgac**: ptp kostki liczony **osobno w kazdej ciaglej fazie
   podporu** (nisko **i** wolno) — L 2,60 → 2,60 cm, P 1,96 → 2,09 cm.

Zapis: **34 klatki** (a nie 33). Ostatnia jest teraz identyczna z pierwsza, dzieki czemu
czas klipu w glTF = 33/30 = **1,1000 s** = pelny okres cyklu. `AnimationMixer` zawija
czas modulo `duration` i trafia dokladnie w poze poczatkowa. Gdyby zapisac 33 klatki,
`duration` wyszlaby 1,0667 s i petla gubilaby jedna klatke w kazdym obrocie.

### Zlacza w grafie animacji (ile mieszania bedzie potrzebne)

Granice `stand_to_walk` i `walk_to_stand` sa **celowo ustawione na kontaktach piety
lewej**, zeby zlacze z `walk_cycle` wypadalo w tej samej fazie kroku. Zmierzone
(z pominieciem `Hips` — jego lokalna rotacja to kurs w swiecie, nie poza):

| zlacze | szew max | szew sredni | stawow > p95 |
|---|---|---|---|
| `stand_to_walk`[kl 172] → `walk_cycle`[start] | 15,24° (`RightForeArm`) | **4,37°** | 6/21 |
| `walk_cycle`[koniec] → `walk_to_stand`[kl 24] | 16,83° (`LeftToeBase`) | **5,03°** | 11/21 |

Kalibracja (te same zlacza w zlym momencie fazy — musza wyjsc gorzej):

| zlacze | szew max | szew sredni | stawow > p95 |
|---|---|---|---|
| B1[kl 154, kontakt **prawej**] → `walk_cycle` | 44,50° | 16,91° | 19/21 |
| B2[kl 41, kontakt **prawej**] → `walk_cycle` | 47,75° | 17,03° | 19/21 |
| B1[kl 10, **stoi**] → `walk_cycle` | 28,76° | 10,44° | 14/21 |
| B2[kl 215, **stoi**] → `walk_cycle` | 29,14° | 8,86° | 14/21 |

Wlasciwa faza jest **3,4–3,9× lepsza** od zlej. Przy sredniej 4,4–5,0° wystarczy
przenikanie rzedu 0,1–0,2 s (3–6 klatek).

---

## 6. Eksport GLB

```
python3 assets_blender/npc_mocap.py --export --optimize --verify
```

Ustawienia importu: `import_anim.bvh(global_scale=0.01, update_scene_fps=True,
use_fps_scale=False, rotate_mode='NATIVE')`.
Eksport: `export_scene.gltf(export_format='GLB', use_selection=True,
export_animation_mode='ACTIONS', export_frame_range=True, export_force_sampling=True,
export_skins=False, export_morph=False, export_materials='NONE')`.
**Sama armatura z animacja — bez siatki.** `export_def_bones` i
`export_armature_object_remove` **nie sa uzywane** (zgodnie z ostrzezeniem).

### Pulapki zlapane w trakcie (obie milcza)

**Pulapka 3 — `update_scene_fps`.** Zademonstrowana, nie tylko ominieta. Ten sam plik
`Male1_A3_SwingArms.bvh` (173 kl @ 30 fps = 5,7333 s) wyeksportowany dwa razy:

```
update_scene_fps=True   scene.fps=30   czas w GLB = 5,7333 s
update_scene_fps=False  scene.fps=24   czas w GLB = 7,1667 s
```

Odczyt tych dwoch plikow w three.js:

```
./glb/trap3_ok.glb    clip.duration=5.7667 s  BVH=5.7333 s  stosunek=1.0058  -> ZGODNE
./glb/trap3_zle.glb   clip.duration=7.2083 s  BVH=5.7333 s  stosunek=1.2573  -> NIEZGODNE (30/24)
```

Sygnatura pulapki dla klipu 30 fps to **1,25×** (30/24), nie 5×. Piecio­krotnosc
wystapilaby dla zrodla 120 fps (120/24 = 5).

**Nowa pulapka, zlapana pomiarem: zakres klatek sceny.** Po
`wm.read_factory_settings(use_empty=True)` scena ma zakres **1..250** i
`import_anim.bvh` **go nie rozszerza**. Przy `export_frame_range=True` eksporter
przycial `idle_lookaround` (479 klatek) do 250 i **dopelnil** `idle_arms` (173 klatki)
do 250 — wszystkie klipy wyszly z czasem 8,3 s, bez zadnego komunikatu. Wykryl to
dopiero `--verify`. Skrypt ustawia teraz zakres z faktycznych keyframe'ow.

**Trzecia: klip nie zaczynal sie w t = 0.** Przyciecie przez `scene.frame_start` dziala,
ale eksporter zapisuje czasy jako `klatka/fps`, wiec `stand_to_walk` zaczynal sie
w t = 1,5333 s i three.js trzymalby przez pierwsze 1,5 s pierwsza klatke. Naprawione
przez usuwanie keyframe'ow poza zakresem i przesuniecie do klatki 0 (`_trim_rebase`).

### Decymacja do 30 fps

Wszystkie klipy Male1 sa **zrodlowo 30 fps**, wiec decymacja jest dla nich tozsamoscia
(krok = 1). Zeby nie zostawiac nieprzetestowanej sciezki kodu, ten sam kod
(`act.layers[0].strips[0].channelbag(action_slot).fcurves` — Blender 5.0 nie ma
`action.fcurves`) puszczony na klipie 120 fps:

```
python3 assets_blender/npc_mocap.py --decim-demo
BVH Male2_B3_Walk.bvh: 531 kl @ 120 fps = 4.4167 s
decymacja krok=4: keyframe 36639 -> 9177 (stosunek 3.992, oczekiwany ~4)
po decymacji: scene.fps=30, zakres 1..133, czas 4.4000 s (oryginal 4.4167 s)
```

### Rozmiary

Eksporter Blendera zapisuje pelne TRS dla kazdej kosci w kazdej klatce, a sciezki
`scale` (zawsze 1,1,1) i `translation` (stale poza `Hips`) sa martwe. `gltf-transform
4.5.0 resample --tolerance 1e-5` + `prune` zwija je do 2 kluczy:
`idle_lookaround` — klatki wg typu **przed**: translation 10538 / rotation 10538 /
scale 10538, **po**: 521 / 9155 / 44.

| klip | GLB | po optymalizacji | gzip −9 |
|---|---|---|---|
| `idle_lookaround` | 443 756 B | **175 032 B** (39 %) | 143 110 B |
| `idle_sway` | 269 556 B | **117 628 B** (44 %) | 93 891 B |
| `walk_to_stand` | 185 760 B | **84 200 B** (45 %) | 65 044 B |
| `idle_arms` | 173 276 B | **79 996 B** (46 %) | 59 349 B |
| `stand_to_walk` | 133 588 B | **64 660 B** (48 %) | 46 239 B |
| `walk_cycle` | 49 980 B | **29 876 B** (60 %) | 15 044 B |
| **razem 6 klipow** | **1 255 916 B** | **551 392 B (44 %)** | **422 677 B** |

Optymalizacja udowodniona jako niezmieniajaca ruchu: oba warianty kazdego klipu
probkowane co 1/60 s i porownane staw po stawie —
**max roznica kata 0,0220–0,1009°, max roznica pozycji stawu w swiecie 0,0012–0,0027 mm**.
Kryterium postawione na widocznym przesunieciu (0,1 mm to 1/19000 wzrostu postaci),
nie na kacie liscia. Kalibracja tego porownania: to samo narzedzie na parze
`walk_cycle` vs `walk_cycle_raw` daje **6,2923° / 50,1094 mm** — czyli miara
odroznia realna roznice od zaokraglenia.

---

## 7. Weryfikacja w three.js r185 pod node

```
cd npc_build/mocap && node verify_three.mjs ./glb_opt ./oczekiwania.json
```

| plik | klip | czas GLB | czas BVH | sciezek | stawow | probek |
|---|---|---|---|---|---|---|
| `idle_sway` | idle_sway | 9,3667 | 9,3667 | 66 | 22 | 282 |
| `idle_lookaround` | idle_lookaround | 15,9333 | 15,9333 | 66 | 22 | 479 |
| `idle_arms` | idle_arms | 5,7333 | 5,7333 | 66 | 22 | 173 |
| `walk_cycle` | walk_cycle | 1,1000 | 1,1000 | 66 | 22 | 34 |
| `stand_to_walk` | stand_to_walk | 4,2333 | 4,2333 | 66 | 22 | 128 |
| `walk_to_stand` | walk_to_stand | 6,2000 | 6,2000 | 66 | 22 | 187 |

Czas zgadza sie **co do 0,0000 s** z BVH w kazdym klipie — pulapka 3 nie wystapila.
66 sciezek = 22 stawy × (translation, rotation, scale).

**Uwaga dla implementacji:** GLB bez siatki nie ma `skins`, wiec `GLTFLoader` tworzy
`Object3D`, **nie `Bone`**. `o.isBone` daje 0 — trafienie w stawy idzie przez nazwe
(`scene.getObjectByName`), co i tak jest tym, czego uzywa `AnimationMixer`.

Pomiar petli chodu **bezposrednio przez `AnimationMixer`**, nie z pliku BVH:

```
szew t=0 vs t=1.1000: max 0.0387 st na ToSpine
najwieksza zmiana miedzy sasiednimi klatkami 30 fps: 25.342 st
krok w cyklu = 1.4414 m, okres 1.1000 s -> predkosc 1.310 m/s
```

### Tautologia zlapana we wlasnym tescie

Pierwsza wersja tego pomiaru robila `mixer.setTime(0); mixer.setTime(D)`. Przy domyslnym
`LoopRepeat` mixer **zawija czas modulo duration**, wiec `setTime(D)` wracalo do t = 0
i test porownywal poze poczatkowa **sama ze soba** — zawsze zielony, zawsze bezwartosciowy.
Objawilo sie to jako `krok w cyklu = 0.0000 m`. Poprawka: `act.loop = THREE.LoopOnce`
i `act.clampWhenFinished = true`.

### Kalibracja asercji o petli

Ten sam cykl wyeksportowany **bez naprawy szwu** (`walk_cycle_raw.glb`, nie wchodzi do gry):

```
szew t=0 vs t=1.1000: max 6.292 st na Neck
stosunek surowy/naprawiony = 162.5x
```

**6,292° zmierzone w three.js zgadza sie co do trzeciego miejsca z 6,292° zmierzonym
niezaleznie w Pythonie z BVH** — dwa rozne lancuchy narzedzi, ta sama liczba.

### Kalibracja samego weryfikatora

Podane celowo zle oczekiwania — kazda asercja musiala oblac:

| co podmienione | reakcja |
|---|---|
| czas ×30/24 (podpis pulapki 3) | `ZLY CZAS (BVH 11.7084)` |
| liczba stawow 22 → 17 | `ZLE KOSCI (ozek. 17)` |
| liczba sciezek 66 → 51 | `ZLE SCIEZKI (ozek. 51)` |

---

## 8. Licencja i wymagana atrybucja

**Zrodlo:** ACCAD Open Motion Project, Advanced Computing Center for the Arts and
Design, The Ohio State University.
**Strona:** <https://accad.osu.edu/research/motion-lab/mocap-system-and-data>
(tytul strony: „MoCap System and Data")

**Licencja:** Creative Commons **Attribution 3.0 Unported (CC BY 3.0)**.
Tekst licencji: <https://creativecommons.org/licenses/by/3.0/>

Oswiadczenie ze strony zrodlowej, doslownie:

> „Open Motion Project by ACCAD/The Ohio State University is licensed under a
> Creative Commons Attribution 3.0 Unported License"

CC BY 3.0 pozwala na uzycie **komercyjne** oraz na **utwory zalezne** (retargeting,
przycinanie, domykanie petli, konwersje formatu) pod jedynym warunkiem podania
atrybucji.

### Wymagana forma atrybucji

Musi byc widoczna dla uzytkownika koncowego (ekran „Credits" / „Zasoby" w grze) oraz
w repozytorium. Minimalna dopuszczalna tresc:

```
Animacje postaci: ACCAD Open Motion Project
(c) ACCAD / The Ohio State University
https://accad.osu.edu/research/motion-lab/mocap-system-and-data
Licencja: CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/
Materiał zmodyfikowany: wybor fragmentow, przyciecie, domkniecie cyklu chodu,
konwersja BVH -> glTF, retargeting na wlasny szkielet.
```

Ostatnie zdanie nie jest opcjonalne — CC BY 3.0 (§4a) wymaga zaznaczenia, ze utwor
zostal zmodyfikowany. Uzyte pliki zrodlowe do wymienienia w repozytorium:
`Male1_A2_Sway`, `Male1_A3_SwingArms`, `Male1_A4_LookAround`, `Male1_B1_StandToWalk`,
`Male1_B2_WalkToStand`, `Male1_B3_Walk`.

---

## 9. Zrodla odrzucone — po jednym zdaniu, zeby nikt do tego nie wracal

Status weryfikacji zaznaczony przy kazdym: **[u zrodla]** = sprawdzone w tej sesji
pobraniem strony, **[z warunkow publikowanych]** = z opublikowanych warunkow, bez
ponownego pobrania w tej sesji.

| zrodlo | powod odrzucenia |
|---|---|
| **AMASS** | Agregat kilkunastu zbiorow, kazdy na wlasnej licencji z osobna rejestracja, a caly format opiera sie na modelu ciala SMPL licencjonowanym wylacznie do badan niekomercyjnych — do gry nie da sie go wprowadzic bez lancucha zgod. *[z warunkow publikowanych]* |
| **SFU Motion Capture Database** | Udostepniany do celow badawczych i akademickich, bez otwartej licencji zezwalajacej na redystrybucje w produkcie. *[z warunkow publikowanych]* |
| **Bandai-Namco Research Motiondataset 1 i 2** | **CC BY-NC 4.0** — czlon NC wyklucza uzycie komercyjne (utwory zalezne sa dozwolone, ale to nie ratuje). *[u zrodla: github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset]* |
| **LAFAN1 (Ubisoft La Forge)** | **CC BY-NC-ND 4.0** — podwojna blokada: NonCommercial **oraz** NoDerivatives, wiec sam retarget i przyciecie cyklu byłyby naruszeniem. *[u zrodla: github.com/ubisoft/ubisoft-laforge-animation-dataset]* |
| **Motorica Dance Dataset** | Licencja niekomercyjna, a zawartosc to taniec do muzyki — nie repertuar mieszczanina na placu. *[z warunkow publikowanych]* |
| **HumanML3D** | To warstwa opisow tekstowych nalozona na AMASS/HumanAct12, wiec dziedziczy caly lancuch licencyjny AMASS i dodatkowo nie jest zbiorem gotowych klipow. *[z warunkow publikowanych]* |
| **Eyes JAPAN / mocapdata.com** | Darmowa czesc katalogu jest niewielka i zdominowana przez taniec i sport, a reszta jest platna per-plik — koszt rozpoznania przewyzsza zysk wobec ACCAD. *[z warunkow publikowanych]* |
| **Mixamo (Adobe)** | Brak otwartej licencji: uzycie jest zwiazane z kontem i EULA Adobe, ktore zabrania redystrybucji samych plikow animacji — nie da sie ich trzymac w publicznym repozytorium. *[z warunkow publikowanych]* |
| **Truebones** | Platne paczki na licencji per-stanowisko, bez prawa do redystrybucji plikow zrodlowych. *[z warunkow publikowanych]* |

Wspolny mianownik: ACCAD jest **jedynym** z rozwazanych zrodel, ktore daje jednoczesnie
uzycie komercyjne, prawo do utworow zaleznych i redystrybucje — za cene jednej linijki
atrybucji.

---

## 10. Pliki

| sciezka | co to |
|---|---|
| `assets_blender/npc_mocap.py` | caly potok: skan, antropometria, cykl, eksport, optymalizacja, weryfikacja |
| `npc_build/mocap/inwentarz.csv` | 299 wierszy: plik, podmiot, kosci, sygnatura, klatki, Frame Time, fps, czas, samokontrola |
| `npc_build/mocap/glb_opt/*.glb` | **6 klipow do gry** (+ `walk_cycle_raw.glb` — tylko kalibracja, nie wchodzi do gry) |
| `npc_build/mocap/Male1_walk_cycle.bvh` | cykl chodu z domknieta petla, 34 klatki |
| `npc_build/mocap/verify_three.mjs` | weryfikacja GLB w three.js + kalibracja szwu |
| `npc_build/mocap/compare_opt.mjs` | dowod, ze optymalizacja nie zmienila ruchu |
| `npc_build/mocap/eksport.json`, `klipy_metryki.json`, `oczekiwania.json` | liczby do dalszych krokow |

## 11. Czego ten etap NIE robi

- **Nie ma retargetingu.** Klipy sa na szkielecie ACCAD (22 stawy, nazwy `Hips`,
  `ToSpine`, `Spine`, `Spine1`, `Neck`, `Head`, `Left/RightShoulder|Arm|ForeArm|Hand`,
  `Left/RightUpLeg|Leg|Foot|ToeBase`). Przelozenie na szkielet MPFB to osobny krok.
- **Nie ma korekty poslizgu stopy.** Zmierzony w cyklu chodu: **2,60 cm (L) / 2,09 cm (P)**
  ptp kostki w fazie podporu. To wlasnosc surowego mocapu, nie blad eksportu. Jesli
  bedzie widoczna, potrzebny jest foot-lock IK (`CCDIKSolver.js` jest w r185).
- **Nie ma skretow.** `Male1_B9`–`B16` (skrety 45/90/135/180°) sa zinwentaryzowane
  i przemierzone, ale nie wyeksportowane — do dolozenia, gdy NPC bedzie zmienial kierunek.
- **Nie ma `A1_Stand`** — patrz punkt 4, klip jest zanieczyszczony odejsciem.
