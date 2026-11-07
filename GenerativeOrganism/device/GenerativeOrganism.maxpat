{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 8,
			"minor": 6,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [
			100,
			100,
			1300,
			800
		],
		"openinpresentation": 1,
		"default_fontsize": 10,
		"default_fontname": "Arial Bold",
		"gridsize": [
			8,
			8
		],
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "newobj",
					"patching_rect": [
						40,
						300,
						101,
						22
					],
					"text": "js organism.js",
					"numinlets": 1,
					"numoutlets": 5,
					"outlettype": [
						"",
						"",
						"",
						"",
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "newobj",
					"patching_rect": [
						40,
						20,
						107.5,
						22
					],
					"text": "live.thisdevice",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"bang",
						"int",
						"int"
					]
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "message",
					"patching_rect": [
						40,
						60,
						40,
						22
					],
					"text": "init",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "newobj",
					"patching_rect": [
						200,
						20,
						224.5,
						22
					],
					"text": "metro 16n @quantize 16n @active 1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					]
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "newobj",
					"patching_rect": [
						200,
						60,
						68.5,
						22
					],
					"text": "transport",
					"numinlets": 2,
					"numoutlets": 9,
					"outlettype": [
						"int",
						"int",
						"float",
						"float",
						"float",
						"",
						"int",
						"float",
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"patching_rect": [
						200,
						100,
						81.5,
						22
					],
					"text": "pack 0 0 0.",
					"numinlets": 3,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"patching_rect": [
						200,
						140,
						81.5,
						22
					],
					"text": "prepend pos",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						20,
						49,
						22
					],
					"text": "midiin",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"int"
					]
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						400,
						55.5,
						22
					],
					"text": "midiout",
					"numinlets": 1,
					"numoutlets": 0,
					"outlettype": []
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						360,
						40,
						22
					],
					"text": "iter",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "newobj",
					"patching_rect": [
						520,
						370,
						120,
						22
					],
					"text": "pattr gostate @parameter_enable 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"parameter_enable": 1,
					"varname": "gostate",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "GO DNA State",
							"parameter_shortname": "DNA",
							"parameter_type": 3,
							"parameter_invisible": 1,
							"parameter_initial_enable": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "newobj",
					"patching_rect": [
						520,
						400,
						107.5,
						22
					],
					"text": "prepend restore",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "newobj",
					"patching_rect": [
						300,
						340,
						62,
						22
					],
					"text": "deferlow",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "newobj",
					"patching_rect": [
						640,
						330,
						107.5,
						22
					],
					"text": "savedialog Midi",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"bang"
					]
				}
			},
			{
				"box": {
					"id": "obj-15",
					"maxclass": "newobj",
					"patching_rect": [
						640,
						370,
						127,
						22
					],
					"text": "prepend exportmidi",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "newobj",
					"patching_rect": [
						760,
						300,
						179,
						22
					],
					"text": "route status sys harm edit",
					"numinlets": 1,
					"numoutlets": 5,
					"outlettype": [
						"",
						"",
						"",
						"",
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "comment",
					"patching_rect": [
						760,
						400,
						300,
						20
					],
					"text": "",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						416,
						122,
						250,
						14
					],
					"fontsize": 9,
					"fontname": "Arial",
					"textcolor": [
						0.75,
						0.75,
						0.75,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "newobj",
					"patching_rect": [
						760,
						360,
						81.5,
						22
					],
					"text": "prepend set",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "comment",
					"patching_rect": [
						900,
						400,
						300,
						20
					],
					"text": "",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						138,
						660,
						14
					],
					"fontsize": 9,
					"fontname": "Arial",
					"textcolor": [
						0.75,
						0.75,
						0.75,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "newobj",
					"patching_rect": [
						900,
						360,
						81.5,
						22
					],
					"text": "prepend set",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "comment",
					"patching_rect": [
						1040,
						400,
						300,
						20
					],
					"text": "",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						152,
						660,
						14
					],
					"fontsize": 9,
					"fontname": "Arial",
					"textcolor": [
						0.75,
						0.75,
						0.75,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "newobj",
					"patching_rect": [
						1040,
						360,
						81.5,
						22
					],
					"text": "prepend set",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "comment",
					"patching_rect": [
						906,
						602,
						200,
						16
					],
					"text": "GENERATIVE ORGANISM",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						2,
						200,
						16
					],
					"fontsize": 10.5,
					"textcolor": [
						0.85,
						0.85,
						0.85,
						1
					],
					"fontface": 1
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "comment",
					"patching_rect": [
						906,
						618,
						96,
						14
					],
					"text": "GENERATOR",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						18,
						96,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						618,
						140,
						14
					],
					"text": "HARMONIC FOUNDATION",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						18,
						140,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "comment",
					"patching_rect": [
						1158,
						618,
						150,
						14
					],
					"text": "HARMONY LIBRARY",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						258,
						18,
						150,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "comment",
					"patching_rect": [
						1316,
						618,
						120,
						14
					],
					"text": "EVOLUTION",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						416,
						18,
						120,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "comment",
					"patching_rect": [
						1574,
						618,
						60,
						14
					],
					"text": "VOICES",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						674,
						18,
						60,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "live.tab",
					"patching_rect": [
						20,
						420,
						96,
						64
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						6,
						32,
						96,
						64
					],
					"varname": "Generator",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Generator",
							"parameter_shortname": "Gen",
							"parameter_type": 2,
							"parameter_enum": [
								"MELODIC",
								"RHYTHMIC",
								"HYBRID",
								"EXPERIMENTAL"
							],
							"parameter_mmax": 3,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 4,
					"num_lines_presentation": 4
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "newobj",
					"patching_rect": [
						20,
						470,
						110,
						22
					],
					"text": "prepend param gen",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-31",
					"maxclass": "live.text",
					"patching_rect": [
						136,
						420,
						46,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						6,
						100,
						46,
						16
					],
					"varname": "Micro",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Micro",
							"parameter_shortname": "Micro",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					},
					"text": "MICRO",
					"texton": "MICRO",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "newobj",
					"patching_rect": [
						136,
						470,
						110,
						22
					],
					"text": "prepend param micro",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-33",
					"maxclass": "live.text",
					"patching_rect": [
						216,
						420,
						46,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						56,
						100,
						46,
						16
					],
					"varname": "Free",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Free",
							"parameter_shortname": "Free",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "FREE",
					"texton": "FREE",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-34",
					"maxclass": "newobj",
					"patching_rect": [
						216,
						470,
						110,
						22
					],
					"text": "prepend param free",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-35",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						632,
						38,
						14
					],
					"text": "Key",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						32,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-36",
					"maxclass": "live.menu",
					"patching_rect": [
						296,
						420,
						104,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						32,
						104,
						15
					],
					"varname": "Key",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Key",
							"parameter_shortname": "Key",
							"parameter_type": 2,
							"parameter_enum": [
								"C",
								"C#",
								"D",
								"Eb",
								"E",
								"F",
								"F#",
								"G",
								"Ab",
								"A",
								"Bb",
								"B"
							],
							"parameter_mmax": 11,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-37",
					"maxclass": "newobj",
					"patching_rect": [
						296,
						470,
						110,
						22
					],
					"text": "prepend param key",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-38",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						650,
						38,
						14
					],
					"text": "Mode",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						50,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-39",
					"maxclass": "live.menu",
					"patching_rect": [
						420,
						420,
						104,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						50,
						104,
						15
					],
					"varname": "Scale",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Scale",
							"parameter_shortname": "Mode",
							"parameter_type": 2,
							"parameter_enum": [
								"Major",
								"Dorian",
								"Phrygian",
								"Lydian",
								"Mixolydian",
								"Minor",
								"Locrian",
								"Harmonic Minor",
								"Melodic Minor",
								"Major Pentatonic",
								"Minor Pentatonic",
								"Phrygian Dominant",
								"Whole Tone",
								"Octatonic"
							],
							"parameter_mmax": 13,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-40",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						470,
						110,
						22
					],
					"text": "prepend param scale",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-41",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						668,
						38,
						14
					],
					"text": "System",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						68,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-42",
					"maxclass": "live.menu",
					"patching_rect": [
						544,
						420,
						104,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						68,
						104,
						15
					],
					"varname": "System",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "System",
							"parameter_shortname": "System",
							"parameter_type": 2,
							"parameter_enum": [
								"Western",
								"Gregorian",
								"Renaissance",
								"Byzantine",
								"Arabic",
								"Persian",
								"Indian",
								"Ancient Greek"
							],
							"parameter_mmax": 7,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-43",
					"maxclass": "newobj",
					"patching_rect": [
						544,
						470,
						110,
						22
					],
					"text": "prepend param syscat",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-44",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						686,
						38,
						14
					],
					"text": "Variant",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						86,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-45",
					"maxclass": "live.numbox",
					"patching_rect": [
						668,
						420,
						40,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						86,
						40,
						15
					],
					"varname": "Variant",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Variant",
							"parameter_shortname": "Var",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 12,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-46",
					"maxclass": "newobj",
					"patching_rect": [
						668,
						470,
						110,
						22
					],
					"text": "prepend param sysvar",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-47",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						704,
						38,
						14
					],
					"text": "Bars",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						104,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-48",
					"maxclass": "live.tab",
					"patching_rect": [
						748,
						420,
						104,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						104,
						104,
						15
					],
					"varname": "Length",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Length",
							"parameter_shortname": "Bars",
							"parameter_type": 2,
							"parameter_enum": [
								"1",
								"2",
								"4",
								"8"
							],
							"parameter_mmax": 3,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 1,
					"num_lines_presentation": 1
				}
			},
			{
				"box": {
					"id": "obj-49",
					"maxclass": "newobj",
					"patching_rect": [
						748,
						470,
						110,
						22
					],
					"text": "prepend param bars",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-50",
					"maxclass": "comment",
					"patching_rect": [
						1008,
						722,
						38,
						14
					],
					"text": "Density",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						108,
						122,
						38,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-51",
					"maxclass": "live.slider",
					"patching_rect": [
						872,
						420,
						104,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						146,
						122,
						104,
						15
					],
					"varname": "Density",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Density",
							"parameter_shortname": "Density",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								75
							],
							"parameter_unitstyle": 5
						}
					},
					"orientation": 1,
					"showname": 0,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-52",
					"maxclass": "newobj",
					"patching_rect": [
						872,
						470,
						110,
						22
					],
					"text": "prepend param density",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-53",
					"maxclass": "live.menu",
					"patching_rect": [
						996,
						420,
						150,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						258,
						32,
						150,
						15
					],
					"varname": "Library",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Library",
							"parameter_shortname": "Library",
							"parameter_type": 2,
							"parameter_enum": [
								"Off (organism)",
								"Renaissance",
								"Baroque",
								"Classical",
								"Romantic",
								"Impressionism",
								"Jazz",
								"Contemporary",
								"World Traditions",
								"User"
							],
							"parameter_mmax": 9,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-54",
					"maxclass": "newobj",
					"patching_rect": [
						996,
						470,
						110,
						22
					],
					"text": "prepend param lib",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-55",
					"maxclass": "comment",
					"patching_rect": [
						1158,
						650,
						26,
						14
					],
					"text": "No.",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						258,
						50,
						26,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-56",
					"maxclass": "live.numbox",
					"patching_rect": [
						20,
						490,
						40,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						286,
						50,
						40,
						15
					],
					"varname": "Progression",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Progression",
							"parameter_shortname": "Prog",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 12,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-57",
					"maxclass": "newobj",
					"patching_rect": [
						20,
						540,
						110,
						22
					],
					"text": "prepend param prog",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-58",
					"maxclass": "comment",
					"patching_rect": [
						1232,
						650,
						26,
						14
					],
					"text": "Len",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						332,
						50,
						26,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-59",
					"maxclass": "live.tab",
					"patching_rect": [
						100,
						490,
						50,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						358,
						50,
						50,
						15
					],
					"varname": "Harmony Length",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Harmony Length",
							"parameter_shortname": "HLen",
							"parameter_type": 2,
							"parameter_enum": [
								"1/2",
								"1",
								"2"
							],
							"parameter_mmax": 2,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 1,
					"num_lines_presentation": 1
				}
			},
			{
				"box": {
					"id": "obj-60",
					"maxclass": "newobj",
					"patching_rect": [
						100,
						540,
						110,
						22
					],
					"text": "prepend param hlen",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-61",
					"maxclass": "textedit",
					"patching_rect": [
						258,
						420,
						150,
						32
					],
					"numinlets": 1,
					"numoutlets": 4,
					"outlettype": [
						"",
						"int",
						"",
						""
					],
					"presentation": 1,
					"presentation_rect": [
						258,
						68,
						150,
						32
					],
					"keymode": 1,
					"lines": 2,
					"fontsize": 9.5,
					"text": "ii7 V7 Imaj7",
					"varname": "progedit"
				}
			},
			{
				"box": {
					"id": "obj-62",
					"maxclass": "newobj",
					"patching_rect": [
						258,
						470,
						101,
						22
					],
					"text": "prepend custom",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-63",
					"maxclass": "newobj",
					"patching_rect": [
						1180,
						360,
						81.5,
						22
					],
					"text": "prepend set",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-64",
					"maxclass": "comment",
					"patching_rect": [
						1158,
						702,
						150,
						14
					],
					"text": "type chords + Enter = User slot",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						258,
						102,
						150,
						14
					],
					"fontsize": 8.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-65",
					"maxclass": "live.tab",
					"patching_rect": [
						180,
						490,
						150,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						416,
						32,
						150,
						15
					],
					"varname": "Evolution",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Evolution",
							"parameter_shortname": "Evo",
							"parameter_type": 2,
							"parameter_enum": [
								"MANUAL",
								"AUTO",
								"HYBRID"
							],
							"parameter_mmax": 2,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 1,
					"num_lines_presentation": 1
				}
			},
			{
				"box": {
					"id": "obj-66",
					"maxclass": "newobj",
					"patching_rect": [
						180,
						540,
						110,
						22
					],
					"text": "prepend param evo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-67",
					"maxclass": "comment",
					"patching_rect": [
						1316,
						650,
						40,
						14
					],
					"text": "Every",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						416,
						50,
						40,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-68",
					"maxclass": "live.tab",
					"patching_rect": [
						350,
						490,
						110,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						456,
						50,
						110,
						15
					],
					"varname": "Speed",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Speed",
							"parameter_shortname": "Every",
							"parameter_type": 2,
							"parameter_enum": [
								"1 bar",
								"2",
								"4",
								"8"
							],
							"parameter_mmax": 3,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 1,
					"num_lines_presentation": 1
				}
			},
			{
				"box": {
					"id": "obj-69",
					"maxclass": "newobj",
					"patching_rect": [
						350,
						540,
						110,
						22
					],
					"text": "prepend param every",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-70",
					"maxclass": "live.dial",
					"patching_rect": [
						480,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						416,
						70,
						46,
						48
					],
					"varname": "Mutation Amount",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mutation Amount",
							"parameter_shortname": "Amount",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								50
							],
							"parameter_unitstyle": 5
						}
					},
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-71",
					"maxclass": "newobj",
					"patching_rect": [
						480,
						540,
						110,
						22
					],
					"text": "prepend param amount",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-72",
					"maxclass": "live.dial",
					"patching_rect": [
						560,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						466,
						70,
						46,
						48
					],
					"varname": "Mutation Probability",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mutation Probability",
							"parameter_shortname": "Prob",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								50
							],
							"parameter_unitstyle": 5
						}
					},
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-73",
					"maxclass": "newobj",
					"patching_rect": [
						560,
						540,
						110,
						22
					],
					"text": "prepend param prob",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-74",
					"maxclass": "live.dial",
					"patching_rect": [
						640,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						516,
						70,
						46,
						48
					],
					"varname": "Stability",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Stability",
							"parameter_shortname": "Stability",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								50
							],
							"parameter_unitstyle": 5
						}
					},
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-75",
					"maxclass": "newobj",
					"patching_rect": [
						640,
						540,
						110,
						22
					],
					"text": "prepend param stability",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-76",
					"maxclass": "live.dial",
					"patching_rect": [
						720,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						566,
						70,
						46,
						48
					],
					"varname": "Complexity",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Complexity",
							"parameter_shortname": "Complex",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								50
							],
							"parameter_unitstyle": 5
						}
					},
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-77",
					"maxclass": "newobj",
					"patching_rect": [
						720,
						540,
						110,
						22
					],
					"text": "prepend param complexity",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-78",
					"maxclass": "live.dial",
					"patching_rect": [
						800,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						616,
						70,
						46,
						48
					],
					"varname": "Variation",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Variation",
							"parameter_shortname": "Variation",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								50
							],
							"parameter_unitstyle": 5
						}
					},
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-79",
					"maxclass": "newobj",
					"patching_rect": [
						800,
						540,
						110,
						22
					],
					"text": "prepend param variation",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-80",
					"maxclass": "comment",
					"patching_rect": [
						1634,
						632,
						32,
						14
					],
					"text": "Ch",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						734,
						32,
						32,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-81",
					"maxclass": "comment",
					"patching_rect": [
						1668,
						632,
						32,
						14
					],
					"text": "Low",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						768,
						32,
						32,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-82",
					"maxclass": "comment",
					"patching_rect": [
						1710,
						632,
						32,
						14
					],
					"text": "High",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						810,
						32,
						32,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-83",
					"maxclass": "comment",
					"patching_rect": [
						1752,
						632,
						32,
						14
					],
					"text": "Dens",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						852,
						32,
						32,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-84",
					"maxclass": "comment",
					"patching_rect": [
						1792,
						632,
						32,
						14
					],
					"text": "Mut",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						892,
						32,
						32,
						14
					],
					"fontsize": 9.5,
					"textcolor": [
						0.6,
						0.6,
						0.6,
						1
					]
				}
			},
			{
				"box": {
					"id": "obj-85",
					"maxclass": "live.text",
					"patching_rect": [
						880,
						490,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						674,
						48,
						56,
						16
					],
					"varname": "Voice 1",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Voice 1",
							"parameter_shortname": "V1",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					},
					"text": "1 Bass",
					"texton": "1 Bass",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-86",
					"maxclass": "newobj",
					"patching_rect": [
						880,
						540,
						110,
						22
					],
					"text": "prepend voice 0 on",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-87",
					"maxclass": "live.numbox",
					"patching_rect": [
						960,
						490,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						734,
						48,
						30,
						16
					],
					"varname": "V1 Channel",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V1 Channel",
							"parameter_shortname": "Ch1",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 16,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-88",
					"maxclass": "newobj",
					"patching_rect": [
						960,
						540,
						110,
						22
					],
					"text": "prepend voice 0 ch",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-89",
					"maxclass": "live.numbox",
					"patching_rect": [
						1040,
						490,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						768,
						48,
						38,
						16
					],
					"varname": "V1 Low",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V1 Low",
							"parameter_shortname": "Lo1",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								28
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-90",
					"maxclass": "newobj",
					"patching_rect": [
						1040,
						540,
						110,
						22
					],
					"text": "prepend voice 0 lo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-91",
					"maxclass": "live.numbox",
					"patching_rect": [
						20,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						810,
						48,
						38,
						16
					],
					"varname": "V1 High",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V1 High",
							"parameter_shortname": "Hi1",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								55
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-92",
					"maxclass": "newobj",
					"patching_rect": [
						20,
						610,
						110,
						22
					],
					"text": "prepend voice 0 hi",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-93",
					"maxclass": "live.numbox",
					"patching_rect": [
						100,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						852,
						48,
						36,
						16
					],
					"varname": "V1 Density",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V1 Density",
							"parameter_shortname": "Dn1",
							"parameter_type": 1,
							"parameter_mmin": -50,
							"parameter_mmax": 50,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-94",
					"maxclass": "newobj",
					"patching_rect": [
						100,
						610,
						110,
						22
					],
					"text": "prepend voice 0 dens",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-95",
					"maxclass": "live.numbox",
					"patching_rect": [
						180,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						892,
						48,
						36,
						16
					],
					"varname": "V1 Mutation",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V1 Mutation",
							"parameter_shortname": "Mu1",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								100
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-96",
					"maxclass": "newobj",
					"patching_rect": [
						180,
						610,
						110,
						22
					],
					"text": "prepend voice 0 mut",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-97",
					"maxclass": "live.text",
					"patching_rect": [
						260,
						560,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						674,
						66,
						56,
						16
					],
					"varname": "Voice 2",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Voice 2",
							"parameter_shortname": "V2",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					},
					"text": "2 Harmony",
					"texton": "2 Harmony",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-98",
					"maxclass": "newobj",
					"patching_rect": [
						260,
						610,
						110,
						22
					],
					"text": "prepend voice 1 on",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-99",
					"maxclass": "live.numbox",
					"patching_rect": [
						340,
						560,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						734,
						66,
						30,
						16
					],
					"varname": "V2 Channel",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V2 Channel",
							"parameter_shortname": "Ch2",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 16,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								2
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-100",
					"maxclass": "newobj",
					"patching_rect": [
						340,
						610,
						110,
						22
					],
					"text": "prepend voice 1 ch",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-101",
					"maxclass": "live.numbox",
					"patching_rect": [
						420,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						768,
						66,
						38,
						16
					],
					"varname": "V2 Low",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V2 Low",
							"parameter_shortname": "Lo2",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								48
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-102",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						610,
						110,
						22
					],
					"text": "prepend voice 1 lo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-103",
					"maxclass": "live.numbox",
					"patching_rect": [
						500,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						810,
						66,
						38,
						16
					],
					"varname": "V2 High",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V2 High",
							"parameter_shortname": "Hi2",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								74
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-104",
					"maxclass": "newobj",
					"patching_rect": [
						500,
						610,
						110,
						22
					],
					"text": "prepend voice 1 hi",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-105",
					"maxclass": "live.numbox",
					"patching_rect": [
						580,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						852,
						66,
						36,
						16
					],
					"varname": "V2 Density",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V2 Density",
							"parameter_shortname": "Dn2",
							"parameter_type": 1,
							"parameter_mmin": -50,
							"parameter_mmax": 50,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-106",
					"maxclass": "newobj",
					"patching_rect": [
						580,
						610,
						110,
						22
					],
					"text": "prepend voice 1 dens",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-107",
					"maxclass": "live.numbox",
					"patching_rect": [
						660,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						892,
						66,
						36,
						16
					],
					"varname": "V2 Mutation",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V2 Mutation",
							"parameter_shortname": "Mu2",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								100
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-108",
					"maxclass": "newobj",
					"patching_rect": [
						660,
						610,
						110,
						22
					],
					"text": "prepend voice 1 mut",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-109",
					"maxclass": "live.text",
					"patching_rect": [
						740,
						560,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						674,
						84,
						56,
						16
					],
					"varname": "Voice 3",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Voice 3",
							"parameter_shortname": "V3",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					},
					"text": "3 Melody",
					"texton": "3 Melody",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-110",
					"maxclass": "newobj",
					"patching_rect": [
						740,
						610,
						110,
						22
					],
					"text": "prepend voice 2 on",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-111",
					"maxclass": "live.numbox",
					"patching_rect": [
						820,
						560,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						734,
						84,
						30,
						16
					],
					"varname": "V3 Channel",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V3 Channel",
							"parameter_shortname": "Ch3",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 16,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								3
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-112",
					"maxclass": "newobj",
					"patching_rect": [
						820,
						610,
						110,
						22
					],
					"text": "prepend voice 2 ch",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-113",
					"maxclass": "live.numbox",
					"patching_rect": [
						900,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						768,
						84,
						38,
						16
					],
					"varname": "V3 Low",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V3 Low",
							"parameter_shortname": "Lo3",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								60
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-114",
					"maxclass": "newobj",
					"patching_rect": [
						900,
						610,
						110,
						22
					],
					"text": "prepend voice 2 lo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-115",
					"maxclass": "live.numbox",
					"patching_rect": [
						980,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						810,
						84,
						38,
						16
					],
					"varname": "V3 High",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V3 High",
							"parameter_shortname": "Hi3",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								86
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-116",
					"maxclass": "newobj",
					"patching_rect": [
						980,
						610,
						110,
						22
					],
					"text": "prepend voice 2 hi",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-117",
					"maxclass": "live.numbox",
					"patching_rect": [
						1060,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						852,
						84,
						36,
						16
					],
					"varname": "V3 Density",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V3 Density",
							"parameter_shortname": "Dn3",
							"parameter_type": 1,
							"parameter_mmin": -50,
							"parameter_mmax": 50,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-118",
					"maxclass": "newobj",
					"patching_rect": [
						1060,
						610,
						110,
						22
					],
					"text": "prepend voice 2 dens",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-119",
					"maxclass": "live.numbox",
					"patching_rect": [
						20,
						630,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						892,
						84,
						36,
						16
					],
					"varname": "V3 Mutation",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V3 Mutation",
							"parameter_shortname": "Mu3",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								100
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-120",
					"maxclass": "newobj",
					"patching_rect": [
						20,
						680,
						110,
						22
					],
					"text": "prepend voice 2 mut",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-121",
					"maxclass": "live.text",
					"patching_rect": [
						100,
						630,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						674,
						102,
						56,
						16
					],
					"varname": "Voice 4",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Voice 4",
							"parameter_shortname": "V4",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								1
							]
						}
					},
					"text": "4 Texture",
					"texton": "4 Texture",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-122",
					"maxclass": "newobj",
					"patching_rect": [
						100,
						680,
						110,
						22
					],
					"text": "prepend voice 3 on",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-123",
					"maxclass": "live.numbox",
					"patching_rect": [
						180,
						630,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						734,
						102,
						30,
						16
					],
					"varname": "V4 Channel",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V4 Channel",
							"parameter_shortname": "Ch4",
							"parameter_type": 1,
							"parameter_mmin": 1,
							"parameter_mmax": 16,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								4
							],
							"parameter_unitstyle": 0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-124",
					"maxclass": "newobj",
					"patching_rect": [
						180,
						680,
						110,
						22
					],
					"text": "prepend voice 3 ch",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-125",
					"maxclass": "live.numbox",
					"patching_rect": [
						260,
						630,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						768,
						102,
						38,
						16
					],
					"varname": "V4 Low",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V4 Low",
							"parameter_shortname": "Lo4",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								62
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-126",
					"maxclass": "newobj",
					"patching_rect": [
						260,
						680,
						110,
						22
					],
					"text": "prepend voice 3 lo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-127",
					"maxclass": "live.numbox",
					"patching_rect": [
						340,
						630,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						810,
						102,
						38,
						16
					],
					"varname": "V4 High",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V4 High",
							"parameter_shortname": "Hi4",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								96
							],
							"parameter_unitstyle": 8
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-128",
					"maxclass": "newobj",
					"patching_rect": [
						340,
						680,
						110,
						22
					],
					"text": "prepend voice 3 hi",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-129",
					"maxclass": "live.numbox",
					"patching_rect": [
						420,
						630,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						852,
						102,
						36,
						16
					],
					"varname": "V4 Density",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V4 Density",
							"parameter_shortname": "Dn4",
							"parameter_type": 1,
							"parameter_mmin": -50,
							"parameter_mmax": 50,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-130",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						680,
						110,
						22
					],
					"text": "prepend voice 3 dens",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-131",
					"maxclass": "live.numbox",
					"patching_rect": [
						500,
						630,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						892,
						102,
						36,
						16
					],
					"varname": "V4 Mutation",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "V4 Mutation",
							"parameter_shortname": "Mu4",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								100
							],
							"parameter_unitstyle": 5
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-132",
					"maxclass": "newobj",
					"patching_rect": [
						500,
						680,
						110,
						22
					],
					"text": "prepend voice 3 mut",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-133",
					"maxclass": "live.text",
					"patching_rect": [
						580,
						630,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						674,
						122,
						56,
						16
					],
					"varname": "APC40",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "APC40",
							"parameter_shortname": "APC40",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "APC40",
					"texton": "APC40",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-134",
					"maxclass": "newobj",
					"patching_rect": [
						580,
						680,
						110,
						22
					],
					"text": "prepend param apc",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-135",
					"maxclass": "live.text",
					"patching_rect": [
						660,
						630,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						32,
						74,
						18
					],
					"varname": "Mutate",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mutate",
							"parameter_shortname": "Mutate",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 0,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "MUTATE",
					"texton": "MUTATE",
					"mode": 0
				}
			},
			{
				"box": {
					"id": "obj-136",
					"maxclass": "newobj",
					"patching_rect": [
						660,
						680,
						110,
						22
					],
					"text": "prepend btn mutate",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-137",
					"maxclass": "live.text",
					"patching_rect": [
						754,
						630,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						52,
						74,
						18
					],
					"varname": "Freeze",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Freeze",
							"parameter_shortname": "Freeze",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "FREEZE",
					"texton": "FREEZE",
					"mode": 1
				}
			},
			{
				"box": {
					"id": "obj-138",
					"maxclass": "newobj",
					"patching_rect": [
						754,
						680,
						110,
						22
					],
					"text": "prepend param freeze",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-139",
					"maxclass": "live.text",
					"patching_rect": [
						848,
						630,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						72,
						74,
						18
					],
					"varname": "Revert",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Revert",
							"parameter_shortname": "Revert",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 0,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "REVERT",
					"texton": "REVERT",
					"mode": 0
				}
			},
			{
				"box": {
					"id": "obj-140",
					"maxclass": "newobj",
					"patching_rect": [
						848,
						680,
						110,
						22
					],
					"text": "prepend btn revert",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-141",
					"maxclass": "live.text",
					"patching_rect": [
						942,
						630,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						92,
						74,
						18
					],
					"varname": "Reset DNA",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Reset DNA",
							"parameter_shortname": "Reset",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 0,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "RESET DNA",
					"texton": "RESET DNA",
					"mode": 0
				}
			},
			{
				"box": {
					"id": "obj-142",
					"maxclass": "newobj",
					"patching_rect": [
						942,
						680,
						110,
						22
					],
					"text": "prepend btn reset",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-143",
					"maxclass": "live.text",
					"patching_rect": [
						1036,
						630,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						112,
						74,
						18
					],
					"varname": "Capture",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Capture",
							"parameter_shortname": "Capture",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 0,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "CAPTURE",
					"texton": "CAPTURE",
					"mode": 0
				}
			},
			{
				"box": {
					"id": "obj-144",
					"maxclass": "newobj",
					"patching_rect": [
						1036,
						680,
						110,
						22
					],
					"text": "prepend btn capture",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			},
			{
				"box": {
					"id": "obj-145",
					"maxclass": "live.text",
					"patching_rect": [
						20,
						700,
						74,
						18
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						940,
						132,
						74,
						18
					],
					"varname": "Export",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Export",
							"parameter_shortname": "Export",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 0,
							"parameter_initial": [
								0
							]
						}
					},
					"text": "EXPORT .MID",
					"texton": "EXPORT .MID",
					"mode": 0
				}
			},
			{
				"box": {
					"id": "obj-146",
					"maxclass": "newobj",
					"patching_rect": [
						20,
						750,
						110,
						22
					],
					"text": "prepend btn export",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					]
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": [
						"obj-2",
						0
					],
					"destination": [
						"obj-3",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-3",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						0
					],
					"destination": [
						"obj-5",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-5",
						0
					],
					"destination": [
						"obj-6",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-5",
						1
					],
					"destination": [
						"obj-6",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-5",
						2
					],
					"destination": [
						"obj-6",
						2
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-6",
						0
					],
					"destination": [
						"obj-7",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-8",
						0
					],
					"destination": [
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						0
					],
					"destination": [
						"obj-10",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-10",
						0
					],
					"destination": [
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						1
					],
					"destination": [
						"obj-11",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-11",
						0
					],
					"destination": [
						"obj-12",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-12",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						3
					],
					"destination": [
						"obj-13",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-13",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						4
					],
					"destination": [
						"obj-14",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-14",
						0
					],
					"destination": [
						"obj-15",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-15",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-16",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						0
					],
					"destination": [
						"obj-18",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						0
					],
					"destination": [
						"obj-17",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						1
					],
					"destination": [
						"obj-20",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-20",
						0
					],
					"destination": [
						"obj-19",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						2
					],
					"destination": [
						"obj-22",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-22",
						0
					],
					"destination": [
						"obj-21",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-29",
						0
					],
					"destination": [
						"obj-30",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-30",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-31",
						0
					],
					"destination": [
						"obj-32",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-32",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-33",
						0
					],
					"destination": [
						"obj-34",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-34",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-36",
						0
					],
					"destination": [
						"obj-37",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-37",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-39",
						0
					],
					"destination": [
						"obj-40",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-40",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-42",
						0
					],
					"destination": [
						"obj-43",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-43",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-45",
						0
					],
					"destination": [
						"obj-46",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-46",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-48",
						0
					],
					"destination": [
						"obj-49",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-49",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						0
					],
					"destination": [
						"obj-52",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-52",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-53",
						0
					],
					"destination": [
						"obj-54",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-54",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-56",
						0
					],
					"destination": [
						"obj-57",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-57",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-59",
						0
					],
					"destination": [
						"obj-60",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-60",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-61",
						0
					],
					"destination": [
						"obj-62",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-62",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						3
					],
					"destination": [
						"obj-63",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-63",
						0
					],
					"destination": [
						"obj-61",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						0
					],
					"destination": [
						"obj-66",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-66",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-68",
						0
					],
					"destination": [
						"obj-69",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-69",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-70",
						0
					],
					"destination": [
						"obj-71",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-71",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-72",
						0
					],
					"destination": [
						"obj-73",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-73",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-74",
						0
					],
					"destination": [
						"obj-75",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-75",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-76",
						0
					],
					"destination": [
						"obj-77",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-77",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-78",
						0
					],
					"destination": [
						"obj-79",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-79",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-85",
						0
					],
					"destination": [
						"obj-86",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-86",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-87",
						0
					],
					"destination": [
						"obj-88",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-88",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-89",
						0
					],
					"destination": [
						"obj-90",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-90",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-91",
						0
					],
					"destination": [
						"obj-92",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-92",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-93",
						0
					],
					"destination": [
						"obj-94",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-94",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-95",
						0
					],
					"destination": [
						"obj-96",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-96",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-97",
						0
					],
					"destination": [
						"obj-98",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-98",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-99",
						0
					],
					"destination": [
						"obj-100",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-100",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-101",
						0
					],
					"destination": [
						"obj-102",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-102",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-103",
						0
					],
					"destination": [
						"obj-104",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-104",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-105",
						0
					],
					"destination": [
						"obj-106",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-106",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-107",
						0
					],
					"destination": [
						"obj-108",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-108",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-109",
						0
					],
					"destination": [
						"obj-110",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-110",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-111",
						0
					],
					"destination": [
						"obj-112",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-112",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-113",
						0
					],
					"destination": [
						"obj-114",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-114",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-115",
						0
					],
					"destination": [
						"obj-116",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-116",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-117",
						0
					],
					"destination": [
						"obj-118",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-118",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-119",
						0
					],
					"destination": [
						"obj-120",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-120",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-121",
						0
					],
					"destination": [
						"obj-122",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-122",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						0
					],
					"destination": [
						"obj-124",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-124",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-125",
						0
					],
					"destination": [
						"obj-126",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-126",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-127",
						0
					],
					"destination": [
						"obj-128",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-128",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-129",
						0
					],
					"destination": [
						"obj-130",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-130",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-131",
						0
					],
					"destination": [
						"obj-132",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-132",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-133",
						0
					],
					"destination": [
						"obj-134",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-134",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-135",
						0
					],
					"destination": [
						"obj-136",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-136",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-137",
						0
					],
					"destination": [
						"obj-138",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-138",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-139",
						0
					],
					"destination": [
						"obj-140",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-140",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-141",
						0
					],
					"destination": [
						"obj-142",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-143",
						0
					],
					"destination": [
						"obj-144",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-144",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-145",
						0
					],
					"destination": [
						"obj-146",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-146",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			}
		],
		"parameters": {
			"obj-11": [
				"GO DNA State",
				"DNA",
				0
			],
			"obj-29": [
				"Generator",
				"Gen",
				0
			],
			"obj-31": [
				"Micro",
				"Micro",
				0
			],
			"obj-33": [
				"Free",
				"Free",
				0
			],
			"obj-36": [
				"Key",
				"Key",
				0
			],
			"obj-39": [
				"Scale",
				"Mode",
				0
			],
			"obj-42": [
				"System",
				"System",
				0
			],
			"obj-45": [
				"Variant",
				"Var",
				0
			],
			"obj-48": [
				"Length",
				"Bars",
				0
			],
			"obj-51": [
				"Density",
				"Density",
				0
			],
			"obj-53": [
				"Library",
				"Library",
				0
			],
			"obj-56": [
				"Progression",
				"Prog",
				0
			],
			"obj-59": [
				"Harmony Length",
				"HLen",
				0
			],
			"obj-65": [
				"Evolution",
				"Evo",
				0
			],
			"obj-68": [
				"Speed",
				"Every",
				0
			],
			"obj-70": [
				"Mutation Amount",
				"Amount",
				0
			],
			"obj-72": [
				"Mutation Probability",
				"Prob",
				0
			],
			"obj-74": [
				"Stability",
				"Stability",
				0
			],
			"obj-76": [
				"Complexity",
				"Complex",
				0
			],
			"obj-78": [
				"Variation",
				"Variation",
				0
			],
			"obj-85": [
				"Voice 1",
				"V1",
				0
			],
			"obj-87": [
				"V1 Channel",
				"Ch1",
				0
			],
			"obj-89": [
				"V1 Low",
				"Lo1",
				0
			],
			"obj-91": [
				"V1 High",
				"Hi1",
				0
			],
			"obj-93": [
				"V1 Density",
				"Dn1",
				0
			],
			"obj-95": [
				"V1 Mutation",
				"Mu1",
				0
			],
			"obj-97": [
				"Voice 2",
				"V2",
				0
			],
			"obj-99": [
				"V2 Channel",
				"Ch2",
				0
			],
			"obj-101": [
				"V2 Low",
				"Lo2",
				0
			],
			"obj-103": [
				"V2 High",
				"Hi2",
				0
			],
			"obj-105": [
				"V2 Density",
				"Dn2",
				0
			],
			"obj-107": [
				"V2 Mutation",
				"Mu2",
				0
			],
			"obj-109": [
				"Voice 3",
				"V3",
				0
			],
			"obj-111": [
				"V3 Channel",
				"Ch3",
				0
			],
			"obj-113": [
				"V3 Low",
				"Lo3",
				0
			],
			"obj-115": [
				"V3 High",
				"Hi3",
				0
			],
			"obj-117": [
				"V3 Density",
				"Dn3",
				0
			],
			"obj-119": [
				"V3 Mutation",
				"Mu3",
				0
			],
			"obj-121": [
				"Voice 4",
				"V4",
				0
			],
			"obj-123": [
				"V4 Channel",
				"Ch4",
				0
			],
			"obj-125": [
				"V4 Low",
				"Lo4",
				0
			],
			"obj-127": [
				"V4 High",
				"Hi4",
				0
			],
			"obj-129": [
				"V4 Density",
				"Dn4",
				0
			],
			"obj-131": [
				"V4 Mutation",
				"Mu4",
				0
			],
			"obj-133": [
				"APC40",
				"APC40",
				0
			],
			"obj-135": [
				"Mutate",
				"Mutate",
				0
			],
			"obj-137": [
				"Freeze",
				"Freeze",
				0
			],
			"obj-139": [
				"Revert",
				"Revert",
				0
			],
			"obj-141": [
				"Reset DNA",
				"Reset",
				0
			],
			"obj-143": [
				"Capture",
				"Capture",
				0
			],
			"obj-145": [
				"Export",
				"Export",
				0
			],
			"parameterbanks": {
				"0": {
					"index": 0,
					"name": "Organism",
					"parameters": [
						"Generator",
						"Evolution",
						"Speed",
						"Mutation Amount",
						"Mutation Probability",
						"Stability",
						"Complexity",
						"Variation"
					]
				},
				"1": {
					"index": 1,
					"name": "Harmony",
					"parameters": [
						"Key",
						"Scale",
						"System",
						"Variant",
						"Length",
						"Density",
						"Library",
						"Progression"
					]
				},
				"2": {
					"index": 2,
					"name": "Actions",
					"parameters": [
						"Mutate",
						"Freeze",
						"Revert",
						"Reset DNA",
						"Capture",
						"Harmony Length",
						"Micro",
						"Free"
					]
				},
				"3": {
					"index": 3,
					"name": "Voices",
					"parameters": [
						"Voice 1",
						"Voice 2",
						"Voice 3",
						"Voice 4",
						"V1 Density",
						"V2 Density",
						"V3 Density",
						"V4 Density"
					]
				},
				"4": {
					"index": 4,
					"name": "Voice Mut",
					"parameters": [
						"V1 Mutation",
						"V2 Mutation",
						"V3 Mutation",
						"V4 Mutation",
						"V1 Channel",
						"V2 Channel",
						"V3 Channel",
						"V4 Channel"
					]
				},
				"5": {
					"index": 5,
					"name": "Ranges",
					"parameters": [
						"V1 Low",
						"V1 High",
						"V2 Low",
						"V2 High",
						"V3 Low",
						"V3 High",
						"V4 Low",
						"V4 High"
					]
				}
			},
			"inherited_shortname": 1
		},
		"dependency_cache": [
			{
				"name": "organism.js",
				"bootpath": ".",
				"type": "TEXT",
				"implicit": 1
			}
		],
		"latency": 0,
		"is_mpe": 0,
		"minimum_live_version": "",
		"minimum_max_version": "",
		"platform_compatibility": 0,
		"autosave": 0
	}
}