import { TIERS, type Difficulty, type Question, type Tier } from '../game/types';
import { questionAdditions } from './questionAdditions';

const tierNames = Object.keys(TIERS) as Tier[];
function make(id: string, category: string, prompt: string, raw: string, difficulty: Difficulty = 'medium'): Question {
  const baseGroups = raw.split(';');
  const extraGroups = (questionAdditions[id] ?? '').split(';');
  const groups = tierNames.map((_, index) => [baseGroups[index], extraGroups[index]].filter(Boolean).join('|'));
  return {
    id, category, prompt, difficulty,
    answers: groups.flatMap((group, groupIndex) => group.split('|').map(item => item.trim()).filter(Boolean).map(item => {
      const [canonical, ...aliases] = item.split('~');
      const tier = tierNames[Math.min(groupIndex, tierNames.length - 1)];
      return { canonical, aliases, tier, points: TIERS[tier] };
    })),
  };
}

export const questions: Question[] = [
  make('geo-01','Geography','Name a country in Africa.','South Africa~RSA|Egypt|Nigeria|Kenya;Morocco|Ghana|Ethiopia|Algeria|Senegal;Tanzania|Uganda|Cameroon|Angola|Zimbabwe;Botswana|Namibia|Zambia|Mozambique;Lesotho|Eswatini~Swaziland|Malawi|Rwanda;Comoros|São Tomé and Príncipe'),
  make('geo-02','Geography','Name a country in South America.','Brazil|Argentina|Chile|Peru;Colombia|Venezuela~Venezuela Bolivarian Republic|Ecuador;Bolivia~Bolivia Plurinational State|Uruguay|Paraguay;Guyana|Suriname;French Guiana;Falkland Islands~Malvinas', 'easy'),
  make('geo-03','Geography','Name a country whose name starts with B.','Brazil|Belgium|Bangladesh|Bulgaria;Bahamas|Bahrain|Belarus;Bolivia|Botswana|Belize;Barbados|Benin;Bhutan|Burundi;Brunei'),
  make('geo-04','Geography','Name a European capital city.','London|Paris|Rome|Berlin;Madrid|Lisbon|Athens;Vienna|Prague|Dublin;Tallinn|Riga;Ljubljana|Bratislava;Podgorica'),
  make('geo-05','Geography','Name an island country.','Japan|Iceland|New Zealand|Madagascar;Sri Lanka|Cuba|Jamaica;Malta|Fiji|Bahamas;Mauritius|Samoa;Vanuatu|Nauru;Kiribati'),
  make('geo-06','Geography','Name a country with a Mediterranean coastline.','Spain|France|Italy|Greece;Turkey|Egypt|Morocco;Tunisia|Croatia|Israel;Albania|Lebanon;Montenegro|Libya;Slovenia'),
  make('geo-07','Geography','Name a landlocked country.','Switzerland|Austria|Bolivia|Nepal;Paraguay|Mongolia|Uganda;Zambia|Zimbabwe|Hungary;Laos|Bhutan;Malawi|Rwanda;Liechtenstein'),
  make('geo-08','Geography','Name a country that uses the euro.','France|Germany|Italy|Spain;Portugal|Ireland|Greece;Austria|Belgium|Netherlands;Finland|Croatia;Estonia|Slovakia;Luxembourg'),
  make('geo-09','Geography','Name a major ocean or sea.','Atlantic Ocean|Pacific Ocean|Indian Ocean|Mediterranean Sea;Arctic Ocean|Caribbean Sea|Red Sea;Black Sea|Baltic Sea|North Sea;Arabian Sea|Coral Sea;Tasman Sea|Bering Sea;Sargasso Sea'),
  make('geo-10','Geography','Name a famous desert.','Sahara|Gobi|Kalahari|Mojave;Atacama|Arabian Desert|Namib;Thar|Sonoran|Great Victoria Desert;Taklamakan|Chihuahuan Desert;Karakum|Patagonian Desert;Dasht-e Lut'),

  make('nature-01','Animals & Nature','Name an animal that lives in the ocean.','Fish|Dolphin|Shark|Whale|Octopus;Seal|Tuna|Jellyfish|Sea lion|Eel;Sea turtle|Crab|Squid|Starfish~sea star;Seahorse|Manta ray|Barracuda;Narwhal|Nautilus|Coelacanth;Dugong|Goblin shark'),
  make('nature-02','Animals & Nature','Name a bird that cannot fly.','Penguin|Ostrich|Emu|Kiwi;Cassowary|Rhea|Kakapo;Takahe|Weka|Steamer duck;Flightless cormorant|Inaccessible Island rail;Campbell teal|Fuegian steamer duck;Kagu'),
  make('nature-03','Animals & Nature','Name a mammal that lays eggs.','Platypus|Short-beaked echidna|Eastern long-beaked echidna;Western long-beaked echidna|Sir David’s long-beaked echidna|Long-beaked echidna;Echidna|Spiny anteater|Monotreme;Zaglossus|Tachyglossus;Attenborough’s long-beaked echidna;Duck-billed platypus', 'challenging'),
  make('nature-04','Animals & Nature','Name a type of big cat.','Lion|Tiger|Leopard|Cheetah;Jaguar|Cougar|Snow leopard;Lynx|Clouded leopard|Serval;Caracal|Ocelot;Margay|Pallas’s cat;Andean mountain cat'),
  make('nature-05','Animals & Nature','Name a tree that produces edible fruit.','Apple tree|Orange tree|Lemon tree|Mango tree;Pear tree|Cherry tree|Peach tree;Plum tree|Fig tree|Avocado tree;Apricot tree|Pomegranate tree;Guava tree|Lychee tree;Breadfruit tree'),
  make('nature-06','Animals & Nature','Name a pollinating animal.','Honeybee|Bumblebee|Butterfly|Moth;Hummingbird|Bat|Beetle;Wasp|Fly|Sunbird;Lemur|Gecko;Possum|Ant;Honey possum'),
  make('nature-07','Animals & Nature','Name an animal with a shell.','Turtle|Snail|Crab|Lobster;Tortoise|Clam|Mussel;Oyster|Nautilus|Armadillo;Barnacle|Scallop;Chiton|Abalone;Brachiopod'),
  make('nature-08','Animals & Nature','Name a nocturnal animal.','Owl|Bat|Raccoon|Fox;Hedgehog|Hyena|Badger;Aye-aye|Opossum|Kinkajou;Pangolin|Bushbaby;Fennec fox|Binturong;Kakapo'),
  make('nature-09','Animals & Nature','Name a species of bear.','Brown bear|Polar bear|American black bear|Giant panda;Asiatic black bear|Sun bear|Sloth bear;Spectacled bear|Grizzly bear|Kodiak bear;European brown bear|Syrian brown bear;Tibetan blue bear|Kermode bear;Gobi bear'),
  make('nature-10','Animals & Nature','Name a flower commonly grown in gardens.','Rose|Tulip|Daisy|Sunflower;Lily|Daffodil|Lavender;Marigold|Petunia|Pansy;Zinnia|Dahlia;Snapdragon|Cosmos;Hellebore'),

  make('science-01','Science & Space','Name a planet in our solar system.','Earth~the Earth|Mars|Jupiter|Venus;Saturn|Mercury|Neptune;Uranus; ; ;', 'easy'),
  make('science-02','Science & Space','Name a moon in our solar system.','Moon~Luna|Europa|Titan|Ganymede;Io|Callisto|Triton;Phobos|Deimos|Enceladus;Rhea|Iapetus;Miranda|Charon;Nereid'),
  make('science-03','Science & Space','Name a chemical element.','Oxygen|Hydrogen|Carbon|Iron;Gold|Silver|Copper;Helium|Nitrogen|Calcium;Tungsten|Cobalt;Bismuth|Xenon;Hafnium'),
  make('science-04','Science & Space','Name a renewable energy source.','Solar energy|Wind energy|Hydroelectric power|Geothermal energy;Tidal power|Wave power|Biomass;Biogas|Ocean thermal energy|Solar thermal energy;Run-of-river power|Landfill gas;Salinity gradient power|Airborne wind energy;Enhanced geothermal systems'),
  make('science-05','Science & Space','Name a type of cloud.','Cumulus|Stratus|Cirrus|Cumulonimbus;Altocumulus|Altostratus|Nimbostratus;Stratocumulus|Cirrostratus|Cirrocumulus;Lenticular cloud|Mammatus;Noctilucent cloud|Kelvin-Helmholtz cloud;Fallstreak hole'),
  make('science-06','Science & Space','Name a unit used to measure length.','Metre~meter|Centimetre~centimeter|Kilometre~kilometer|Millimetre~millimeter;Inch|Foot|Yard;Mile|Micrometre~micrometer|Nanometre~nanometer;Nautical mile|Light-year;Parsec|Fathom;Angstrom'),
  make('science-07','Science & Space','Name a bone in the human body.','Skull|Femur|Rib|Spine;Tibia|Fibula|Humerus;Radius|Ulna|Pelvis;Patella|Scapula;Clavicle|Sternum;Stapes'),
  make('science-08','Science & Space','Name a branch of science.','Biology|Chemistry|Physics|Astronomy;Geology|Ecology|Meteorology;Botany|Zoology|Genetics;Seismology|Oceanography;Paleontology|Mycology;Tribology'),
  make('science-09','Science & Space','Name a layer of Earth.','Crust|Mantle|Outer core|Inner core;Lithosphere|Asthenosphere|Mesosphere;Upper mantle|Lower mantle|Oceanic crust;Continental crust|Core;D double-prime layer|Mohorovicic discontinuity;Transition zone'),
  make('science-10','Science & Space','Name a simple machine.','Lever|Wheel and axle|Pulley|Inclined plane;Wedge|Screw|Gear;Ramp|Block and tackle|Crank;Capstan|Winch;Treadle|Windlass;Toggle mechanism'),

  make('food-01','Food & Drink','Name a fruit that grows on a tree.','Apple|Orange|Mango|Pear;Peach|Cherry|Plum;Lemon|Avocado|Fig;Apricot|Pomegranate;Persimmon|Lychee;Quince'),
  make('food-02','Food & Drink','Name a type of cheese.','Cheddar|Mozzarella|Parmesan|Brie;Gouda|Feta|Camembert;Ricotta|Gruyere|Blue cheese;Halloumi|Manchego;Emmental|Paneer;Roquefort'),
  make('food-03','Food & Drink','Name a herb used in cooking.','Basil|Parsley|Rosemary|Thyme;Coriander~cilantro|Mint|Oregano;Sage|Dill|Chives;Tarragon|Bay leaf;Marjoram|Lemongrass;Chervil'),
  make('food-04','Food & Drink','Name a pasta shape.','Spaghetti|Penne|Macaroni|Lasagne;Fusilli|Farfalle|Linguine;Rigatoni|Ravioli|Tortellini;Orecchiette|Tagliatelle;Cavatappi|Bucatini;Radiatori'),
  make('food-05','Food & Drink','Name a hot drink.','Tea|Coffee|Hot chocolate|Espresso;Cappuccino|Latte|Herbal tea;Chai|Green tea|Mocha;Masala chai|Rooibos;Mate|Hot toddy;Salep'),
  make('food-06','Food & Drink','Name a vegetable that grows underground.','Potato|Carrot|Onion|Beetroot~beet;Radish|Turnip|Sweet potato;Garlic|Parsnip|Ginger;Yam|Cassava;Celeriac|Jerusalem artichoke;Jicama'),
  make('food-07','Food & Drink','Name a common baking ingredient.','Flour|Sugar|Eggs|Butter;Milk|Baking powder|Salt;Vanilla|Cocoa|Yeast;Bicarbonate of soda~baking soda|Cornstarch;Molasses|Cream of tartar;Almond meal'),
  make('food-08','Food & Drink','Name a dish made with rice.','Fried rice|Risotto|Paella|Biryani;Sushi|Pilaf|Jambalaya;Rice pudding|Congee|Arancini;Dolma|Bibimbap;Kedgeree|Nasi goreng;Kabsa'),

  make('music-01','Music','Name a musical instrument.','Guitar|Piano|Drums|Violin;Trumpet|Flute|Saxophone;Cello|Clarinet|Harp;Oboe|Trombone;Bassoon|Mandolin;Theremin'),
  make('music-02','Music','Name a brass instrument.','Trumpet|Trombone|French horn|Tuba;Cornet|Euphonium|Flugelhorn;Baritone horn|Sousaphone|Bugle;Tenor horn|Alto horn;Cimbasso|Wagner tuba;Sackbut'),
  make('music-03','Music','Name a percussion instrument.','Drum kit|Tambourine|Xylophone|Cymbals;Triangle|Marimba|Timpani;Bongo drums|Conga drums|Glockenspiel;Castanets|Cowbell;Guiro|Cajon;Vibraphone'),
  make('music-04','Music','Name a type of musical ensemble.','Orchestra|Choir|Band|Quartet;Trio|Duet|Big band;Brass band|String quartet|Chamber orchestra;Wind ensemble|Glee club;Consort|Marching band;Gamelan'),
  make('music-05','Music','Name a musical tempo marking.','Allegro|Andante|Adagio|Presto;Largo|Moderato|Vivace;Lento|Grave|Prestissimo;Allegretto|Andantino;Larghissimo|Maestoso;Larghetto'),
  make('music-06','Music','Name a string instrument played with a bow.','Violin|Viola|Cello|Double bass;Erhu|Fiddle|Rebec;Hardanger fiddle|Nyckelharpa|Sarangi;Kamancheh|Lira;Morin khuur|Crwth;Tromba marina'),
  make('music-07','Music','Name a style of music.','Pop|Rock|Jazz|Classical;Hip hop|Country|Blues;Reggae|Folk|Electronic;Funk|Soul;Bluegrass|Afrobeat;Shoegaze'),
  make('music-08','Music','Name a part of a song structure.','Verse|Chorus|Bridge|Intro;Outro|Refrain|Pre-chorus;Hook|Breakdown|Interlude;Coda|Solo;Post-chorus|Middle eight;Turnaround'),

  make('screen-01','Film & TV','Name a film genre.','Comedy|Drama|Action|Horror;Romance|Science fiction~sci-fi|Thriller;Fantasy|Documentary|Animation;Western|Musical;Film noir|Biopic;Mockumentary'),
  make('screen-02','Film & TV','Name a job found on a film set.','Actor|Director|Producer|Camera operator;Screenwriter|Costume designer|Makeup artist;Editor|Sound mixer|Gaffer;Grip|Foley artist;Script supervisor|Best boy;Continuity coordinator'),
  make('screen-03','Film & TV','Name a type of television programme.','News|Sitcom|Game show|Documentary;Drama series|Reality show|Talk show;Cartoon|Sports broadcast|Soap opera;Travel show|Cooking show;Panel show|Anthology series;Variety show'),
  make('screen-04','Film & TV','Name an animation technique.','2D animation|3D animation|Stop motion|Clay animation~claymation;Rotoscoping|Cutout animation|Motion capture;Pixilation|Cel animation|Computer animation;Sand animation|Paint-on-glass animation;Pinscreen animation|Silhouette animation;Strata-cut animation'),
  make('screen-05','Film & TV','Name a character from The Wizard of Oz.','Dorothy|Scarecrow|Tin Man|Cowardly Lion;Toto|Glinda|Wicked Witch;Wizard of Oz|Aunt Em|Uncle Henry;Munchkin Mayor|Nikko;Professor Marvel|Miss Gulch;Winged Monkey'),
  make('screen-06','Film & TV','Name a fictional detective.','Sherlock Holmes|Hercule Poirot|Nancy Drew|Batman;Miss Marple|Philip Marlowe|Veronica Mars;Columbo|Jessica Fletcher|Inspector Morse;Sam Spade|Father Brown;Lord Peter Wimsey|Nero Wolfe;C. Auguste Dupin'),
  make('screen-07','Film & TV','Name a movie award.','Academy Award~Oscar|Golden Globe|BAFTA|Emmy;Palme d’Or|César Award|Screen Actors Guild Award;Golden Lion|European Film Award|Critics Choice Award;Goya Award|Ariel Award;David di Donatello|Silver Bear;Golden Leopard'),
  make('screen-08','Film & TV','Name something shown in film credits.','Actors|Director|Producer|Writers;Composer|Editor|Cinematographer;Costume designer|Casting director|Stunt performers;Visual effects team|Foley artists;Location manager|Colorist;Animal wrangler'),

  make('games-01','Video Games','Name a video game genre.','Action|Adventure|Puzzle|Role-playing game~RPG;Strategy|Simulation|Sports;Racing|Platformer|Fighting;Rhythm|Survival;Visual novel|Roguelike;Metroidvania'),
  make('games-02','Video Games','Name a chess piece.','King|Queen|Pawn|Knight~horse;Bishop|Rook~castle; ; ; ;', 'easy'),
  make('games-03','Video Games','Name something commonly collected in a video game.','Coins|Points|Gems|Keys;Stars|Hearts|Weapons;Power-ups|Experience points~XP|Health potions;Cards|Badges;Artifacts|Crafting materials;Korok seeds'),
  make('games-04','Video Games','Name a classic board game.','Chess|Checkers~draughts|Monopoly|Scrabble;Cluedo~Clue|Risk|Backgammon;Go|Battleship|Othello~Reversi;Ludo|Mancala;Senet|Nine Men’s Morris;Hnefatafl'),
  make('games-05','Video Games','Name a playing card rank.','Ace|King|Queen|Jack;Ten|Nine|Eight;Seven|Six|Five;Four|Three;Two|Joker;Knight'),
  make('games-06','Video Games','Name a tabletop role-playing die.','d20|d6|d10|d8;d12|d4|d100;percentile die|fudge die|d3;d2|d24;d30|d16;d7'),
  make('games-07','Video Games','Name a common video game control.','Move|Jump|Attack|Pause;Crouch|Sprint|Block;Interact|Aim|Dodge;Reload|Open map;Inventory|Use item;Photo mode'),
  make('games-08','Video Games','Name a type of puzzle.','Crossword|Sudoku|Jigsaw puzzle|Word search;Maze|Riddle|Logic puzzle;Anagram|Cryptogram|Sliding puzzle;Nonogram|Tangram;Kakuro|KenKen;Hashiwokakero'),

  make('history-01','History','Name an ancient civilisation.','Ancient Egypt|Ancient Greece|Roman Empire|Maya;Aztec|Inca|Mesopotamia;Persian Empire|Indus Valley civilisation|Viking civilisation;Phoenicia|Carthage;Minoan civilisation|Olmec;Nok culture'),
  make('history-02','History','Name a historical writing material.','Paper|Papyrus|Parchment|Clay tablet;Vellum|Stone|Bamboo slips;Wax tablet|Palm leaf|Birch bark;Silk|Wooden tablet;Bone|Ostracon;Copper plate'),
  make('history-03','History','Name an invention that changed transport.','Wheel|Steam engine|Aeroplane|Automobile;Bicycle|Railway locomotive|Sailing ship;Internal combustion engine|Hot-air balloon|Helicopter;Jet engine|Diesel engine;Maglev train|Hovercraft;Sextant'),
  make('history-04','History','Name a famous explorer.','Marco Polo|Christopher Columbus|Amelia Earhart|Ibn Battuta;Zheng He|James Cook|Roald Amundsen;Sacagawea|Ernest Shackleton|David Livingstone;Matthew Henson|Jeanne Baret;Pytheas|Isabella Bird;Nain Singh Rawat'),
  make('history-05','History','Name a kind of historical fortification.','Castle|Fort|City wall|Moat;Rampart|Bastion|Watchtower;Citadel|Palisade|Keep;Barbican|Battlement;Ravelin|Martello tower;Star fort'),
  make('history-06','History','Name a job people did in medieval towns.','Blacksmith|Baker|Carpenter|Weaver;Miller|Butcher|Cobbler;Potter|Tanner|Chandler;Cooper|Fletcher;Wheelwright|Fuller;Cordwainer'),
  make('history-07','History','Name a famous ancient structure.','Great Pyramid of Giza|Colosseum|Great Wall of China|Parthenon;Stonehenge|Petra|Machu Picchu;Pantheon|Temple of Karnak|Pompeii;Chichen Itza|Borobudur;Newgrange|Tikal;Göbekli Tepe'),
  make('history-08','History','Name a source historians use.','Letters|Photographs|Diaries|Newspapers;Maps|Official records|Artefacts;Oral histories|Coins|Buildings;Census records|Gravestones;Ship logs|Court records;Tree rings'),

  make('sport-01','Sports','Name a sport played with a ball.','Football~soccer|Basketball|Tennis|Rugby;Cricket|Volleyball|Baseball;Golf|Hockey|Handball;Water polo|Squash;Lacrosse|Netball;Sepak takraw'),
  make('sport-02','Sports','Name an Olympic swimming stroke.','Freestyle~front crawl|Backstroke|Breaststroke|Butterfly; ; ; ; ;', 'easy'),
  make('sport-03','Sports','Name a track and field event.','100 metres|Long jump|High jump|Marathon;Shot put|Javelin throw|Discus throw;Pole vault|Hurdles|Relay race;Triple jump|Hammer throw;Steeplechase|Decathlon;Race walking'),
  make('sport-04','Sports','Name a winter sport.','Skiing|Snowboarding|Ice hockey|Figure skating;Curling|Bobsleigh|Speed skating;Luge|Skeleton|Biathlon;Ski jumping|Nordic combined;Short track speed skating|Freestyle skiing;Ski mountaineering'),
  make('sport-05','Sports','Name a piece of sports protective equipment.','Helmet|Mouthguard|Shin guards|Knee pads;Elbow pads|Goggles|Gloves;Chest protector|Shoulder pads|Wrist guards;Boxing headgear|Cricket pads;Athletic cup|Fencing mask;Neck guard'),
  make('sport-06','Sports','Name a racket sport.','Tennis|Badminton|Squash|Table tennis;Padel|Racquetball|Pickleball;Real tennis|Soft tennis|Beach tennis;Speed-ball|Crossminton;Rackets|Basque pelota;Frontenis'),
  make('sport-07','Sports','Name a position in football or soccer.','Goalkeeper|Striker|Midfielder|Defender;Winger|Centre-back|Full-back;Sweeper|Attacking midfielder|Defensive midfielder;Wing-back|Centre-forward;Left-back|Right-back;False nine'),
  make('sport-08','Sports','Name a martial art.','Karate|Judo|Taekwondo|Kung fu;Aikido|Muay Thai|Brazilian jiu-jitsu;Kendo|Capoeira|Krav Maga;Sambo|Wing Chun;Silat|Savate;Pencak silat'),

  make('words-01','Words & Books','Name a punctuation mark.','Full stop~period|Comma|Question mark|Exclamation mark;Colon|Semicolon|Apostrophe;Quotation mark|Hyphen|Dash;Parenthesis|Slash;Ellipsis|Ampersand;Interrobang'),
  make('words-02','Words & Books','Name a genre of fiction.','Fantasy|Mystery|Romance|Science fiction~sci-fi;Horror|Historical fiction|Thriller;Adventure|Crime|Young adult;Magical realism|Dystopian;Bildungsroman|Gothic fiction;Slipstream'),
  make('words-03','Words & Books','Name a part of a book.','Cover|Title page|Chapter|Index;Table of contents|Spine|Preface;Glossary|Appendix|Bibliography;Foreword|Afterword;Colophon|Epigraph;Errata'),
  make('words-04','Words & Books','Name a language spoken in South Africa.','English|isiZulu~Zulu|isiXhosa~Xhosa|Afrikaans;Sepedi|Setswana|Sesotho;Tshivenda|siSwati|isiNdebele;XiTsonga|South African Sign Language;Khoekhoegowab|Nama;Fanagalo'),
  make('words-05','Words & Books','Name a writing system.','Latin alphabet|Arabic script|Cyrillic alphabet|Chinese characters;Devanagari|Hebrew alphabet|Greek alphabet;Hangul|Japanese kana|Thai script;Ge’ez script|Armenian alphabet;Cherokee syllabary|Tifinagh;Ogham'),
  make('words-06','Words & Books','Name a type of poem.','Sonnet|Haiku|Limerick|Epic;Ode|Ballad|Elegy;Free verse|Acrostic|Villanelle;Sestina|Ghazal;Pantoum|Cinquain;Clerihew'),
  make('words-07','Words & Books','Name a literary device.','Metaphor|Simile|Alliteration|Personification;Foreshadowing|Irony|Hyperbole;Onomatopoeia|Symbolism|Imagery;Oxymoron|Allegory;Synecdoche|Chiasmus;Zeugma'),
  make('words-08','Words & Books','Name a famous fictional animal.','Winnie-the-Pooh|Snoopy|Garfield|Paddington Bear;Peter Rabbit|Tigger|The Cat in the Hat;Babe|Black Beauty|Clifford;Aslan|Moby Dick;Falkor|Babar;Mrs Frisby'),

  make('everyday-01','Everyday Life','Name something found in a kitchen.','Fridge|Oven|Sink|Kettle;Toaster|Microwave|Pan;Knife|Spoon|Plate;Whisk|Colander;Mortar and pestle|Mandoline;Ramekin'),
  make('everyday-02','Everyday Life','Name something you might carry in a backpack.','Water bottle|Book|Phone|Wallet;Keys|Notebook|Pen;Lunch|Charger|Jacket;Umbrella|Headphones;First-aid kit|Torch;Power bank'),
  make('everyday-03','Everyday Life','Name a tool used for gardening.','Spade|Rake|Hoe|Watering can;Trowel|Pruning shears|Garden fork;Wheelbarrow|Hose|Lawn mower;Dibber|Secateurs;Mattock|Soil sieve;Hori hori'),
  make('everyday-04','Everyday Life','Name a type of footwear.','Shoes|Boots|Sandals|Slippers;Trainers~sneakers|High heels|Flip-flops;Loafers|Clogs|Brogues;Espadrilles|Moccasins;Wellingtons|Oxfords;Huaraches'),
  make('everyday-05','Everyday Life','Name a source of light.','Sun|Light bulb|Candle|Torch~flashlight;Lamp|Fire|Lantern;LED|Moon|Match;Glow stick|Neon sign;Bioluminescence|Oil lamp;Chemiluminescence'),
  make('everyday-06','Everyday Life','Name a common item of clothing.','Shirt|Trousers~pants|Dress|Jacket;Skirt|Socks|Jumper~sweater;Coat|Shorts|Hat;Scarf|Waistcoat;Dungarees~overalls|Poncho;Cummerbund'),
  make('everyday-07','Everyday Life','Name something used to tell time.','Clock|Watch|Phone|Sundial;Hourglass|Stopwatch|Timer;Alarm clock|Calendar|Water clock;Pendulum clock|Cuckoo clock;Chronometer|Candle clock;Astrolabe'),
  make('everyday-08','Everyday Life','Name a room commonly found in a home.','Bedroom|Kitchen|Bathroom|Living room;Dining room|Study|Garage;Laundry room|Attic|Basement;Pantry|Conservatory;Mudroom|Games room;Butler’s pantry'),

  make('sa-01','South Africa','Name a province of South Africa.','Gauteng|Western Cape~WC|KwaZulu-Natal~KZN|Eastern Cape~EC;Limpopo|Mpumalanga~MP|Free State~FS;North West~NW|Northern Cape~NC; ; ;', 'easy'),
  make('sa-02','South Africa','Name a South African city or major town.','Johannesburg|Cape Town|Durban|Pretoria|Soweto;Gqeberha~Port Elizabeth|Bloemfontein|Polokwane|East London;Mbombela~Nelspruit|Kimberley|Mahikeng|Pietermaritzburg;George|Mthatha|Rustenburg;Stellenbosch|Paarl|Welkom;Upington|Makhanda~Grahamstown'),
  make('sa-03','South Africa','Name an animal found in Kruger National Park.','Lion|Elephant|Leopard|Buffalo;Rhinoceros|Giraffe|Zebra;Hippopotamus|Cheetah|Hyena;Wild dog|Kudu;Sable antelope|Honey badger;Pangolin'),
  make('sa-04','South Africa','Name a South African food or dish.','Braai|Biltong|Boerewors|Bobotie;Bunny chow|Melktert|Koeksister;Chakalaka|Potjiekos|Malva pudding;Vetkoek|Pap;Waterblommetjiebredie|Umngqusho;Denningvleis'),
  make('sa-05','South Africa','Name a landmark in South Africa.','Table Mountain|Robben Island|Kruger National Park|Cape Point;Union Buildings|Voortrekker Monument|Apartheid Museum;Blyde River Canyon|Drakensberg|Cradle of Humankind;Mapungubwe|Golden Gate Highlands;Hole in the Wall|Augrabies Falls;Richtersveld'),
  make('sa-06','South Africa','Name a South African national symbol.','Springbok|Protea|Blue crane|Galjoen;Yellowwood tree|South African flag|National anthem;Coat of arms|King protea|Real yellowwood;Secretarybird|Spear and knobkierie;Rising sun|Elephant tusks;Wheat ears'),
  make('sa-07','South Africa','Name a river in southern Africa.','Orange River|Limpopo River|Vaal River|Zambezi River;Tugela River|Olifants River|Breede River;Great Fish River|Komati River|Caledon River;Molopo River|Umgeni River;Crocodile River|Levubu River;Nossob River'),
  make('sa-08','South Africa','Name a mountain or mountain range in southern Africa.','Table Mountain|Drakensberg|Magaliesberg|Lion’s Head;Cederberg|Swartberg|Outeniqua Mountains;Amatola Mountains|Soutpansberg|Waterberg;Winterberg|Lebombo Mountains;Mafadi|Compassberg;Seweweekspoort Peak'),
];

export const categories = ['All', ...Array.from(new Set(questions.map(q => q.category)))];
