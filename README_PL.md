# Allumeria Enhanced - Aurora 0.13.0-test (loader 0.13.1)

## Loader i ustawienia 0.13.1

- Zakladka Allumeria Enhanced ma wlasna ikone 16x16, poprawnie wgrywana do
  odwroconego pionowo atlasu interfejsu gry.
- Kazda paczka wczytuje osobny plik `icon.png` wskazany przez `pack.json`.
- Kazdy `pack.json` moze miec sekcje `settings` i zmieniac tylko wybrane
  ustawienia przy przelaczeniu na te paczke.
- Do menu dodano post-processing, AO, wyostrzanie, DoF, moc promieni
  ksiezyca i moc cieni chmur.
- Domyslne promienie ksiezyca Aurory sa wyraznie mocniejsze, a ich natezenie
  mozna regulowac w zakresie 0-250%.
- Polska wersja jezykowa znajduje sie w osobnej paczce `pl-PL` i nie jest
  czescia instalatora shaderow.

Po wymianie Loader.dll wymagany jest pelny restart gry.

## Aurora 0.12.5 - cienie chmur
Chmury przyciemniaja teraz nasloneczniony teren maksymalnie o okolo 14%.
Maska jest rzutowana zgodnie z kierunkiem slonca, porusza sie razem z
chmurami i korzysta z dziewieciu szeroko rozlozonych probek.

## Aurora 0.12.4 - ksiezycowe godrays
W nocy mapa cieni zaslania teraz osobne chlodne promienie ksiezyca.
Ich sila zalezy od wysokosci i mocy/fazy ksiezyca, jest slabsza od
promieni slonecznych i zanika wraz ze switem. Pod woda sa wylaczone.

## Aurora 0.12.3 - stabilnosc ruchu i chmury
Usunieto dwa przesuwajace sie pola sinusoidalne z podwodnej mgly,
poniewaz tworzyly kierunkowe ruchome pasy. Animacje zostaja w zawiesinie,
kaustyce i zalamaniu tafli. Chmury maja jasniejszy ambient od spodu,
slabsza roznice wysokosci oraz miekki limiter jasnych partii w poludnie.

## Aurora 0.12.2 - daleki plan
SSAO zanika miedzy 34 a 82 jednostkami, a wyostrzanie miedzy 48 a 112.
SSAO jest dodatkowo wygaszane na duzych skokach glebi. Zapobiega to
konturom i pionowym pasom na dalekich drzewach oraz geometrii LOD.

## Aurora 0.12.1 - woda
Pod woda usunieto ekranowe promienie oparte o mape cieni, ktore przy
plytkiej tafli tworzyly poziome pasy. Zastapiono je ciagla mgla glebi,
wolno animowanym pradem koloru, dwoma obracanymi polami kaustyki i
lagodniejszym ruchem zalamania od spodu tafli. Kwadratowa zawiesina nadal
unosi sie w siatce swiata. Pelne ray tracing nie jest obecnie dostepne:
silnik OpenGL 3.3 nie udostepnia shaderowi geometrii/akceleracji sceny.
Woda ma jedynie ograniczone sledzenie promieni SSR w obrazie.

## Nowy etap obrazu Aurory
Przed interfejsem: przestrzenne SSAO (12 probek), ograniczone wyostrzanie
adaptowane do kontrastu oraz opcjonalny daleki DoF z kontrola glebi.
To autorskie proste SSAO i wyostrzanie, nie GTAO/CACAO ani kod AMD CAS.
Brak TAA, sledzenia promieni i wektorow ruchu. HUD nie przechodzi przez efekt.
Piksele wody i maska reki sa pomijane w AO/DoF; zapobiega to uzyciu
niezgodnej glebi na przezroczystej tafli. To ograniczenie, nie AO wody.
Aurora uzywa koncowego etapu Retro: podczas jej dzialania przelacznik
ditheringu jest wymuszony, poprzednia wartosc wraca po zmianie paczki.
Nie zmieniaj natywnego przelacznika ditheringu podczas uzywania Aurory.

W settings.json nowe opcje (brak klucza oznacza wartosc domyslna):
PostProcessing=true, AmbientOcclusion=0.55, Sharpening=0.35,
DepthOfField=false. DoF mozna testowo wlaczyc przez true i F8.
Nowy Loader.dll wymaga uruchomienia gry na nowo przy tej aktualizacji;
kolejne edycje shaderow i zmiany paczek przechodza przez F8.
Test kompilacji nie zastępuje oceny wizualnej i wydajnosci w grze.


## Cztery paczki i poprawki 0.11.1

Classic, Fabulous, Experimental oraz nowa Aurora.
Nacisnij F8, nastepnie wybierz paczke w ustawieniach.

Experimental: jasniejsze ambientowe swiatlo chmur, kierunkowe swiatlo
sloneczne i kolor zmieniajacy sie z wysokoscia slonca. Mniejsze zalamanie
obrazu pod woda, filtrowane probki cieni w promieniach, bez dodawania
promieni drugi raz na tafli. Wymagana ocena pasow w ruchu.

Fabulous: ograniczone rozpraszanie Mie o poranku i mniej rozowego zafarbu
chmur. Sloneczne rozpraszanie wygaszane pod horyzontem.

Aurora bazuje na poprawionym Experimental i dodaje:
- 4 probki oslabienia swiatla wewnatrz chmury w kierunku slonca,
- kierunkowe rozpraszanie chmur i niezalezne wypelnienie otoczeniem,
- analityczne przyblizenie mgly wysokosciowej z ograniczona gestoscia,
- rozna absorpcje RGB wody na podstawie glebi widoku,
- lagodne zawijanie oswietlenia na roslinnosci.
Zachowuje SSR, mapy cieni, godrays, grading, proceduralne kaustyki i fale.
Samocieniowanie chmur kosztuje dodatkowe probki: FPS nie zmierzono.

Nie wdrozono wszystkich technik: brak RT/PT, SSAO/GTAO/CACAO, TAA,
CAS, pelnoekranowego DoF i blooma. Wymagaja odrebnej pracy nad
etapami renderowania; nie sa zastepowane nazwami filtrow.
Test: kompilacja i linkowanie 52 programow czterech paczek.
Brak potwierdzenia wizualnego w grze.

Inspiracje i dokumentacja (bez kopiowania kodu):
https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn
https://gpuopen.com/manuals/fidelityfx_sdk/techniques/combined-adaptive-compute-ambient-occlusion/


## Trzecia paczka Experimental

Osobna paczka na bazie Fabulous 0.10.9. Classic i Fabulous bez zmian.
F8 odswieza liste; wybierz Experimental w Settings > Allumeria Enhanced.
Nie trzeba wymieniac loadera 0.10.8.

- Chmury maja ograniczona jasnosc noca, niezalezna od niebieskiego koloru
  pobieranego przez silnik pod woda; delikatnie ciemniejsze spody.
- Sloneczne rozpraszanie atmosferyczne jest wygaszane pod horyzontem.
  Mniejsza poswiata tarczy i rozpraszanie przy patrzeniu na slonce,
  dodatkowo ograniczone pod woda. To nie nowy bloom postprocess.
- Mocniejsze nasycenie, nizsza ekspozycja i wyrazniejsze cienie.
- Silniejsze zaburzenia normalnych wody, gradient przezroczystosci
  z glebokosci widoku oraz delikatne proceduralne kaustyki na dnie.
  Kaustyki sa stylizowana animacja, nie fizyczne sledzenie refrakcji.
  Wykrywanie zanurzenia nadal korzysta z kolumny wody nad kamera.
- SSAO/GTAO, CAS i DoF nie zostaly dodane w tej wersji.
- 13 programow Experimental skompilowanych i zlinkowanych.
  Brak potwierdzenia wizualnego w grze; wersja do porownania A/B.


## Aktualizacja shaderow 0.10.9

- Classic: pojedyncza tarcza ksiezyca bez nakladajacego sie wyciecia;
  kolor uwzglednia przezroczystosc podczas addytywnego rysowania.
- Fabulous: nocne przeswitywanie od slonca wylaczone; slabsze swiatlo
  bezposrednie na roslinnosci, delikatne wypelnienie spodow przy dostepie nieba.
- Podwodne promienie nie dostaja porannego wzmocnienia i sa slabsze.
- Warstwy mgly skladaja sie jako ciagla gestosc optyczna, z szerszym
  koncowym zanikiem terenu i odleglych lisci.
- Swiatlo mocno czerwonych emiterow przesuniete ku cieplej barwie;
  slabsze ogony oswietlenia blokowego przy duzej odleglosci kamery.
  Filtr nie rozpoznaje lawy niezaleznie od innych czerwonych emiterow.
- Wymagany loader 0.10.8; te zmiany wczytuje F8 bez wymiany DLL.
- Test kompilacji nie zastepuje oceny obrazu w grze.


## Aktualizacja 0.10.8

- Fabulous: szybszy przesuw chmur (2 bloki/s zamiast 0.6).
- Mniejszy niebieski zafarb atmosfery, slabsze swiatlo nieba w jaskiniach.
- Lagodniejsze odlegle cienie terenu; lokalny filtr rosnie wraz z odlegloscia
  odbiornika od przeszkody (uproszczona penumbra, nie pelne PCSS).
- Kolor lokalnego swiatla przeliczany przed tonemappingiem, cieplejsza pochodnia.
- Mniejszy dodatkowy skladnik swiatla postawionych emiterow, wygaszany
  w odleglosci 5-10 blokow. Ogranicza skoki jasnosci przy wyborze zrodla;
  nadal tylko jeden lokalny emiter ma mape cieni.
- Umiarkowane tlumienie mocno czerwonego oswietlenia blokowego.
  Nie jest to osobna symulacja swiatla lawy.
- Zmiany wymagaja oceny wizualnej; kompilacja nie potwierdza wygladu w ruchu.


## Aktualizacja 0.10.7

- Fabulous: slabsze bezposrednie swiatlo ksiezyca i wypelnienie koron drzew,
  zachowane zaslanianie przez teren. Slabsze wypelnienie odleglych lisci.
- Nowy 8-dniowy cykl faz oparty na zapisanym worldDay/worldTime.
  To cykl dodany przez mod: sprawdzony renderer gry uzywa stalej tekstury.
  Widoczna czesc tarczy, halo i sila swiatla korzystaja z tej samej fazy.
- Godrays rano do 55 procent mocniejsze, z plynnym narastaniem i wygasaniem.
  48 probek z przestrzennym jitterem zamiast 24 regularnych warstw.
- Dodatkowa delikatna mgla od 2 blokow, gradient temperatury barwy
  i niewielkie ograniczenie nasycenia samej mgly. Bez rozmycia tekstur.
- Widok spod tafli: bez SSR przeznaczonego dla widoku znad wody.
  Pozostaje refrakcja; jawne filtrowanie biliniowe obrazu oraz przejscie
  zalezne od liniowej glebi zamiast progow w nieliniowym buforze.
  Nie jest to pelna symulacja calkowitego wewnetrznego odbicia.
- Testy kompilacji nie zastepuja oceny pasow i migotania w ruchu w grze.
- Zmiana loadera wymaga jednorazowej podmiany DLL przy zamknietej grze.
  Zmiany GLSL nadal mozna przeladowywac F8.


## Aktualizacja 0.10.6

- Fabulous: neutralniejsze swiatlo ksiezyca i wypelnienie lisci, takze LOD.
  Kierunkowa mapa cieni pracuje noca z kierunku ksiezyca.
- SSR: perspektywiczny marsz po ekranie, przedzialy glebi i weryfikacja trafienia.
  Inspirowane opisem McGuire/Mara:
  https://casual-effects.blogspot.com/2014/08/screen-space-ray-tracing.html
  SSR nadal nie odtwarza obiektow poza ekranem lub zaslonietych przez reke.
- Fabulous: kwadratowe drobinki pod woda, mocniejsze promienie takze na
  widzianej od dolu powierzchni wody. Mocniejsza bliska i srednia mgla.
  Nasycenie podniesione o 3.5 procent.
- Testy: kompilacja/linkowanie 39 programow GLSL oraz kompilacja loadera.
  Wyglad, migotanie i SSR podczas zoomu wymagaja oceny w grze.
- Nowy loader wymaga jednorazowego zamkniecia gry do podmiany DLL.
  Kolejne zmiany GLSL przeladowuje F8 bez restartowania gry.


## Aktualizacja 0.10.5

- SSR pomija piksele modeli pierwszoosobowych przez osobny bufor maski R8.
  Rozpoznanie modelu wykorzystuje pozycje kotwicy reki, skale modelu
  i tryb pierwszoosobowy. W miejscach zaslonietych przez przedmiot
  pozostaje odbicie atmosfery, nie odtworzona geometria za przedmiotem.
- Porownanie lokalnych cieni uwzglednia rzeczywisty srodek texela cubemapy
  i geometryczna plaszczyzne trojkata; dotyczy tez lian.
- Fabulous: delikatne swiatlo ksiezyca dla terenu, modeli i LOD lisci.
  Nie dodano oddzielnej mapy cieni ksiezyca.
- Mniejszy niebieski zafarb atmosfery.
- Pod woda: proceduralne unoszace sie drobinki, zaslaniane przez geometrie,
  oraz mocniejsze istniejace promienie slonca na terenie.
  To drobinki shaderowe, nie fizyczne babelki gry. Granica wody oparta
  na lokalnej kolumnie nad kamera; nieregularne zbiorniki wymagaja testow.
- Testy: 39 par GLSL skompilowanych i zlinkowanych; test dodatkowego bufora
  R8 (kompletnosc, czyszczenie, odczyt) przeszedl bez bledu OpenGL.
  Loader skompilowany. Nie przeprowadzono testu wizualnego w swiecie gry.

Nowy loader wymaga jednego ponownego uruchomienia gry.
Pozniejsze zmiany shaderow przeladowuje F8.

## Fabulous: chmury i daleki plan (aktualizacja GLSL 2026-09-04)

Obrys chmur opiera sie na segmentach 32x32; wysokosc ma stopniowane warstwy.
Usunieto rozbieznosci mgly pomiedzy terenem, billboardami, LOD lisci,
postaciami, blokami specjalnymi i woda. Ostatnie 20% zasiegu ma lagodne
wygaszenie do atmosfery. LOD lisci korzysta teraz z tej samej korekcji
barw co teren. To nie zwieksza szczegolow geometrii LOD.
Wczytanie: F8; bez wymiany loadera.
Test: 9 rzeczywistych par shaderow skompilowanych i zlinkowanych.
Brak wizualnego potwierdzenia w uruchomionej grze.

Przeglad jeszcze niewdrozonych technik:
- SMAA (MIT): wygladzanie krawedzi; wymaga osobnego przebiegu obrazu,
  buforow posrednich i tekstur Area/Search.
  https://github.com/iryoku/smaa
- Plynne przejscia LOD: wymagaja jednoczesnego dostepu do obu modeli,
  nie tylko fragment shadera. Przyklad bgfx 12-lod:
  https://bkaradzic.github.io/bgfx/examples.html
- ASSAO i bloom: przyklady bgfx 39-assao i 38-bloom; wymagaja dodatkowych
  przebiegow. Nie rozwiazuja niespojnego koloru odleglych lisci.
- TAA / temporalne odszumianie: potrzebuja historii klatek i poprawnej
  reprojekcji, zwlaszcza dla animowanych roslin. Obecnie niewdrozone.
- Mipmapy z zachowaniem pokrycia alfa i ochrona atlasu: wazny kolejny etap.
  Gra generuje mipmapy, ale TextureMaxLod ogranicza do 0 lub 1. Zmiana
  bez zabezpieczenia granic kafelkow grozi przeciekaniem innych tekstur.

Nie kopiowano kodu z zewnetrznych shaderpackow; zmiany GLSL sa wlasne.
Publicznie dostepne zrodla nie oznaczaja automatycznie dowolnej licencji.

## Poprawki 0.10.3

Chmury Fabulous korzystaja z koloru chmur gry (biom i pora dnia).
Usunieto cieniowanie wewnetrznych scianek tworzace kratke.
Mgla zmienia gestosc stopniowo wedlug biomu; dochodzi slaba blizsza warstwa.
Fabulous ma mniejszy kontrast, chlodniejsza korekcje i okolo 20% mocniejsze godrays.

Lokalne cienie maja 9 probek zamiast jednej, mniejszy bias i geometryczne
normalne roslin. Blok emitujacy swiatlo nie zaslania wlasnego punktu swiatla.
Zmniejszono offset mapy slonecznej na cienkich, niemal rownoleglych trojkatach.
Sa to poprawki ograniczajace aliasing, nie temporalna akumulacja/TAA.

SSR dostosowuje kroki do FOV i lagodniej przechodzi w odbicie atmosfery.
Obiekty poza ekranem nadal nie moga pojawic sie w SSR: zoom moze je wyciac.
Brak pelnego GI: nie symulujemy odbijania kolorowego swiatla miedzy blokami.
Test kompilacji/linkowania: 21 programow; brak wizualnego testu w grze.

## Poprawki 0.10.2

- Interpolacja porownan mapy cieni ogranicza skoki podczas ruchu roslin.
- Lokalna mapa pochodni uwzglednia zaladowane chunki poza kadrem kamery.
- Wyzsze chmury Fabulous skladaja przezroczystosc mniejszych komorek.
- Fabulous: delikatna daleka mgla, korekcja temperatury cieni/swiatel
  i lagodzenie przepalen; bez rozmywania tekstur.
- Test tej aktualizacji: 15 par GLSL skompilowanych i zlinkowanych,
  loader zbudowany. Efekt wizualny i stabilnosc wymagaja sprawdzenia w grze.

## Cienie i chmury w 0.10

Naprawiono nazwy i konwencje macierzy mapy slonecznej. Kierunek swiatla korzysta
z tego samego czasu i obrotu co slonce gry. Animacje lisci w mapie cieni
odpowiadaja animacjom widocznej geometrii, bez skokowego zaokraglania czasu.
Godrays Fabulous odczytuja naprawiona mape cieni.

Lokalna mapa szescienna 512x512 na sciane obsluguje JEDNO zrodlo naraz:
trzymana pochodnie, a bez niej najblizszy emisyjny blok w promieniu ok. 8 blokow.
Zasieg mapy wynosi 16 blokow. Nie jest to system cieni wszystkich swiatel naraz.
Przeszkodami sa modele chunkow i ich roslinnosc z maska alfa.
Postacie odbieraja lokalne cienie, ale nie sa jeszcze osobnymi obiektami
rzucajacymi cien w tym przebiegu. Wbudowane oswietlenie blokow pozostaje baza;
mapa zaslania dodany skladnik bezposredni, nie usuwa calego swiatla otoczenia.
Ta funkcja wymaga wlaczenia Shadow map.

Fabulous wylacza stare chmury przy wlaczonych shaderach. Wlasne chmury
probkowane sa przestrzennie w warstwie 256-288, z ksztaltem opartym na
komorkach 8x4x8, czterema poziomami gestosci, ruchem wiatru i kolorem dnia/nocy.
Classic zachowuje dotychczasowe chmury.

Testy: kompilacja/linkowanie 14 zmienionych par; rzeczywisty zapis glebokosci
slonecznej 0.25 i lokalnej 0.03173 dla trojkata testowego; OpenGL NoError.
Brak potwierdzenia wizualnego w dzialajacym swiecie gry.

## Instalacja i aktualizacja

Zamknij gre po zapisaniu swiata. Wypakuj katalog mods z paczki do katalogu
Allumerii obok Allumeria.exe i potwierdz zamiane Loader.dll.
Po wymianie samego loadera potrzebne jest jedno uruchomienie gry.
Kolejne zmiany paczki i F8 nie wymagaja restartowania gry.

Przy aktualizacji z 0.8 przenies stare paczki poza katalog shaderpacks.
Na tej instalacji zachowano je w mods/AllumeriaEnhanced/backup-packs-20260904.

## Dwie paczki

- Classic: delikatna korekcja obrazu, lagodne chmury, oryginalna kolorystyka.
- Fabulous: cieple swiatlo i chlodniejsze cienie, lekka mgla w oddali,
  odbicia oraz promienie swiatla probkujace mape cieni.

Tekstury gry i wody nie zostaly zmienione. Presety jakosci sa niezalezne od paczek.

## Sterowanie

Settings > Allumeria Enhanced: wybor paczki, folder paczek i ustawienia.
F8: ponownie wczytuje ustawienia i kompiluje 11 programow GPU wybranej paczki.
Po sukcesie wyswietla sie Live reload OK. Przy bledzie pozostaja stare programy.
Edytuj GLSL w shaderpacks/Classic/shaders lub shaderpacks/Fabulous/shaders,
nie w res/shaders, ktory jest katalogiem wdrozeniowym.

F10: wlacz/wylacz efekty. F9: zmien preset.
C (przytrzymaj): zoom. Kolko podczas zoomu zmienia przyblizenie bez zmiany slotu.
Na czacie, w menu i podczas przypisywania skrotow zoom nie dziala.
Skroty mozna zmienic w Settings > Controls.

## Ograniczenia i testy

SSR odbija geometrie dostepna w buforze ekranu. Poza ekranem korzysta z koloru
atmosfery; nie jest to pelny ray tracing ani odbicie obiektow spoza kadru.
Godrays korzystaja z mapy cieni, jej zasiegu i dostepnej geometrii.
Classic i Fabulous: 22/22 programy skompilowane i zlinkowane na NVIDIA OpenGL 3.3.
Przechwytywanie delty kolka sprawdzone w izolowanym tescie OpenTK.
Ocena obrazu w swiecie i przelaczania paczek w dzialajacej grze wymaga uruchomienia
nowego loadera; test kompilacji nie zastepuje testu wizualnego.

Inspiracja: dostarczona paczka Klimatyczne_Odbicia_v4.2 (SSR, Fresnel i fallback).
Dodatkowe materialy:
https://casual-effects.blogspot.com/2014/08/screen-space-ray-tracing.html
https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
