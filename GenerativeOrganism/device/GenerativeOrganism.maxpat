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
			1240,
			760
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
					"numoutlets": 4,
					"outlettype": [
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
					"maxclass": "comment",
					"patching_rect": [
						700,
						360,
						400,
						20
					],
					"text": "GENERATIVE ORGANISM",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						150,
						500,
						16
					],
					"fontsize": 9.5,
					"varname": "status"
				}
			},
			{
				"box": {
					"id": "obj-15",
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
					"id": "obj-16",
					"maxclass": "comment",
					"patching_rect": [
						906,
						620,
						96,
						14
					],
					"text": "GENERATOR",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						6,
						20,
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
					"id": "obj-17",
					"maxclass": "comment",
					"patching_rect": [
						1012,
						620,
						130,
						14
					],
					"text": "HARMONIC FOUNDATION",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						112,
						20,
						130,
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
					"id": "obj-18",
					"maxclass": "comment",
					"patching_rect": [
						1152,
						620,
						120,
						14
					],
					"text": "EVOLUTION",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						252,
						20,
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
					"id": "obj-19",
					"maxclass": "comment",
					"patching_rect": [
						1406,
						620,
						60,
						14
					],
					"text": "VOICES",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						506,
						20,
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
					"id": "obj-20",
					"maxclass": "live.tab",
					"patching_rect": [
						20,
						420,
						96,
						34
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						6,
						34,
						96,
						34
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
								"RHYTHMIC"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_unitstyle": 9
						}
					},
					"num_lines_patching": 2,
					"num_lines_presentation": 2
				}
			},
			{
				"box": {
					"id": "obj-21",
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
					"id": "obj-22",
					"maxclass": "comment",
					"patching_rect": [
						1012,
						634,
						34,
						14
					],
					"text": "Key",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						112,
						34,
						34,
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
					"id": "obj-23",
					"maxclass": "live.menu",
					"patching_rect": [
						136,
						420,
						92,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						150,
						34,
						92,
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
					"id": "obj-24",
					"maxclass": "newobj",
					"patching_rect": [
						136,
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
					"id": "obj-25",
					"maxclass": "comment",
					"patching_rect": [
						1012,
						652,
						34,
						14
					],
					"text": "Mode",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						112,
						52,
						34,
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
					"maxclass": "live.menu",
					"patching_rect": [
						248,
						420,
						92,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						150,
						52,
						92,
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
							"parameter_shortname": "Scale",
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
								"Minor Pentatonic"
							],
							"parameter_mmax": 10,
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
					"id": "obj-27",
					"maxclass": "newobj",
					"patching_rect": [
						248,
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
					"id": "obj-28",
					"maxclass": "comment",
					"patching_rect": [
						1012,
						670,
						34,
						14
					],
					"text": "Bars",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						112,
						70,
						34,
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
						360,
						420,
						92,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						150,
						70,
						92,
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
					"id": "obj-30",
					"maxclass": "newobj",
					"patching_rect": [
						360,
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
					"id": "obj-31",
					"maxclass": "live.dial",
					"patching_rect": [
						472,
						420,
						44,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						150,
						92,
						44,
						48
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
					"showname": 1,
					"shownumber": 1
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "newobj",
					"patching_rect": [
						472,
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
					"id": "obj-33",
					"maxclass": "live.tab",
					"patching_rect": [
						552,
						420,
						150,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						252,
						34,
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
					"id": "obj-34",
					"maxclass": "newobj",
					"patching_rect": [
						552,
						470,
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
					"id": "obj-35",
					"maxclass": "comment",
					"patching_rect": [
						1152,
						652,
						40,
						14
					],
					"text": "Every",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						252,
						52,
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
					"id": "obj-36",
					"maxclass": "live.tab",
					"patching_rect": [
						722,
						420,
						110,
						15
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						292,
						52,
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
					"id": "obj-37",
					"maxclass": "newobj",
					"patching_rect": [
						722,
						470,
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
					"id": "obj-38",
					"maxclass": "live.dial",
					"patching_rect": [
						852,
						420,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						252,
						92,
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
					"id": "obj-39",
					"maxclass": "newobj",
					"patching_rect": [
						852,
						470,
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
					"id": "obj-40",
					"maxclass": "live.dial",
					"patching_rect": [
						932,
						420,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						302,
						92,
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
					"id": "obj-41",
					"maxclass": "newobj",
					"patching_rect": [
						932,
						470,
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
					"id": "obj-42",
					"maxclass": "live.dial",
					"patching_rect": [
						1012,
						420,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						352,
						92,
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
					"id": "obj-43",
					"maxclass": "newobj",
					"patching_rect": [
						1012,
						470,
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
					"id": "obj-44",
					"maxclass": "live.dial",
					"patching_rect": [
						1092,
						420,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						402,
						92,
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
					"id": "obj-45",
					"maxclass": "newobj",
					"patching_rect": [
						1092,
						470,
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
					"id": "obj-46",
					"maxclass": "live.dial",
					"patching_rect": [
						20,
						490,
						46,
						48
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						452,
						92,
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
					"id": "obj-47",
					"maxclass": "newobj",
					"patching_rect": [
						20,
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
					"id": "obj-48",
					"maxclass": "comment",
					"patching_rect": [
						1466,
						634,
						40,
						14
					],
					"text": "Ch",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						566,
						34,
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
					"id": "obj-49",
					"maxclass": "comment",
					"patching_rect": [
						1500,
						634,
						40,
						14
					],
					"text": "Low",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						600,
						34,
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
					"id": "obj-50",
					"maxclass": "comment",
					"patching_rect": [
						1542,
						634,
						40,
						14
					],
					"text": "High",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						642,
						34,
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
					"id": "obj-51",
					"maxclass": "comment",
					"patching_rect": [
						1584,
						634,
						40,
						14
					],
					"text": "Dens",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						684,
						34,
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
					"id": "obj-52",
					"maxclass": "comment",
					"patching_rect": [
						1624,
						634,
						40,
						14
					],
					"text": "Mut",
					"numinlets": 1,
					"numoutlets": 0,
					"presentation": 1,
					"presentation_rect": [
						724,
						34,
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
					"id": "obj-53",
					"maxclass": "live.text",
					"patching_rect": [
						100,
						490,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						506,
						50,
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
					"id": "obj-54",
					"maxclass": "newobj",
					"patching_rect": [
						100,
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
					"id": "obj-55",
					"maxclass": "live.numbox",
					"patching_rect": [
						180,
						490,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						566,
						50,
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
					"id": "obj-56",
					"maxclass": "newobj",
					"patching_rect": [
						180,
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
					"id": "obj-57",
					"maxclass": "live.numbox",
					"patching_rect": [
						260,
						490,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						600,
						50,
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
					"id": "obj-58",
					"maxclass": "newobj",
					"patching_rect": [
						260,
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
					"id": "obj-59",
					"maxclass": "live.numbox",
					"patching_rect": [
						340,
						490,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						642,
						50,
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
					"id": "obj-60",
					"maxclass": "newobj",
					"patching_rect": [
						340,
						540,
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
					"id": "obj-61",
					"maxclass": "live.numbox",
					"patching_rect": [
						420,
						490,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						684,
						50,
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
					"id": "obj-62",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						540,
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
					"id": "obj-63",
					"maxclass": "live.numbox",
					"patching_rect": [
						500,
						490,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						724,
						50,
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
					"id": "obj-64",
					"maxclass": "newobj",
					"patching_rect": [
						500,
						540,
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
					"id": "obj-65",
					"maxclass": "live.text",
					"patching_rect": [
						580,
						490,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						506,
						70,
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
					"id": "obj-66",
					"maxclass": "newobj",
					"patching_rect": [
						580,
						540,
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
					"id": "obj-67",
					"maxclass": "live.numbox",
					"patching_rect": [
						660,
						490,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						566,
						70,
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
					"id": "obj-68",
					"maxclass": "newobj",
					"patching_rect": [
						660,
						540,
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
					"id": "obj-69",
					"maxclass": "live.numbox",
					"patching_rect": [
						740,
						490,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						600,
						70,
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
					"id": "obj-70",
					"maxclass": "newobj",
					"patching_rect": [
						740,
						540,
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
					"id": "obj-71",
					"maxclass": "live.numbox",
					"patching_rect": [
						820,
						490,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						642,
						70,
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
					"id": "obj-72",
					"maxclass": "newobj",
					"patching_rect": [
						820,
						540,
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
					"id": "obj-73",
					"maxclass": "live.numbox",
					"patching_rect": [
						900,
						490,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						684,
						70,
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
					"id": "obj-74",
					"maxclass": "newobj",
					"patching_rect": [
						900,
						540,
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
					"id": "obj-75",
					"maxclass": "live.numbox",
					"patching_rect": [
						980,
						490,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						724,
						70,
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
					"id": "obj-76",
					"maxclass": "newobj",
					"patching_rect": [
						980,
						540,
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
					"id": "obj-77",
					"maxclass": "live.text",
					"patching_rect": [
						1060,
						490,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						506,
						90,
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
					"id": "obj-78",
					"maxclass": "newobj",
					"patching_rect": [
						1060,
						540,
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
					"id": "obj-79",
					"maxclass": "live.numbox",
					"patching_rect": [
						20,
						560,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						566,
						90,
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
					"id": "obj-80",
					"maxclass": "newobj",
					"patching_rect": [
						20,
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
					"id": "obj-81",
					"maxclass": "live.numbox",
					"patching_rect": [
						100,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						600,
						90,
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
					"id": "obj-82",
					"maxclass": "newobj",
					"patching_rect": [
						100,
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
					"id": "obj-83",
					"maxclass": "live.numbox",
					"patching_rect": [
						180,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						642,
						90,
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
					"id": "obj-84",
					"maxclass": "newobj",
					"patching_rect": [
						180,
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
					"id": "obj-85",
					"maxclass": "live.numbox",
					"patching_rect": [
						260,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						684,
						90,
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
					"id": "obj-86",
					"maxclass": "newobj",
					"patching_rect": [
						260,
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
					"id": "obj-87",
					"maxclass": "live.numbox",
					"patching_rect": [
						340,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						724,
						90,
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
					"id": "obj-88",
					"maxclass": "newobj",
					"patching_rect": [
						340,
						610,
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
					"id": "obj-89",
					"maxclass": "live.text",
					"patching_rect": [
						420,
						560,
						56,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						506,
						110,
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
					"id": "obj-90",
					"maxclass": "newobj",
					"patching_rect": [
						420,
						610,
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
					"id": "obj-91",
					"maxclass": "live.numbox",
					"patching_rect": [
						500,
						560,
						30,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						566,
						110,
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
					"id": "obj-92",
					"maxclass": "newobj",
					"patching_rect": [
						500,
						610,
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
					"id": "obj-93",
					"maxclass": "live.numbox",
					"patching_rect": [
						580,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						600,
						110,
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
					"id": "obj-94",
					"maxclass": "newobj",
					"patching_rect": [
						580,
						610,
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
					"id": "obj-95",
					"maxclass": "live.numbox",
					"patching_rect": [
						660,
						560,
						38,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						642,
						110,
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
					"id": "obj-96",
					"maxclass": "newobj",
					"patching_rect": [
						660,
						610,
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
					"id": "obj-97",
					"maxclass": "live.numbox",
					"patching_rect": [
						740,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						684,
						110,
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
					"id": "obj-98",
					"maxclass": "newobj",
					"patching_rect": [
						740,
						610,
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
					"id": "obj-99",
					"maxclass": "live.numbox",
					"patching_rect": [
						820,
						560,
						36,
						16
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						724,
						110,
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
					"id": "obj-100",
					"maxclass": "newobj",
					"patching_rect": [
						820,
						610,
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
					"id": "obj-101",
					"maxclass": "live.text",
					"patching_rect": [
						900,
						560,
						74,
						20
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						770,
						34,
						74,
						20
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
					"id": "obj-102",
					"maxclass": "newobj",
					"patching_rect": [
						900,
						610,
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
					"id": "obj-103",
					"maxclass": "live.text",
					"patching_rect": [
						994,
						560,
						74,
						20
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						770,
						58,
						74,
						20
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
					"id": "obj-104",
					"maxclass": "newobj",
					"patching_rect": [
						994,
						610,
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
					"id": "obj-105",
					"maxclass": "live.text",
					"patching_rect": [
						1088,
						560,
						74,
						20
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						770,
						82,
						74,
						20
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
					"id": "obj-106",
					"maxclass": "newobj",
					"patching_rect": [
						1088,
						610,
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
					"id": "obj-107",
					"maxclass": "live.text",
					"patching_rect": [
						20,
						630,
						74,
						20
					],
					"parameter_enable": 1,
					"presentation": 1,
					"presentation_rect": [
						770,
						106,
						74,
						20
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
					"id": "obj-108",
					"maxclass": "newobj",
					"patching_rect": [
						20,
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
						2
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
						"obj-20",
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
						"obj-21",
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
						"obj-23",
						0
					],
					"destination": [
						"obj-24",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
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
						"obj-26",
						0
					],
					"destination": [
						"obj-27",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-27",
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
						"obj-38",
						0
					],
					"destination": [
						"obj-39",
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
						"obj-1",
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
						"obj-41",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-41",
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
						"obj-44",
						0
					],
					"destination": [
						"obj-45",
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
						"obj-1",
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
						"obj-47",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-47",
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
						"obj-55",
						0
					],
					"destination": [
						"obj-56",
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
						"obj-1",
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
						"obj-58",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-58",
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
						"obj-63",
						0
					],
					"destination": [
						"obj-64",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-64",
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
						"obj-67",
						0
					],
					"destination": [
						"obj-68",
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
						"obj-1",
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
						"obj-70",
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
						"obj-1",
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
						"obj-72",
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
						"obj-1",
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
						"obj-74",
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
						"obj-1",
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
						"obj-76",
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
						"obj-1",
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
						"obj-78",
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
						"obj-1",
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
						"obj-80",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-80",
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
						"obj-81",
						0
					],
					"destination": [
						"obj-82",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-82",
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
						"obj-83",
						0
					],
					"destination": [
						"obj-84",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-84",
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
			}
		],
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
		"project": {
			"version": 1,
			"creationdate": 3590052493,
			"modificationdate": 3590052493,
			"viewrect": [
				0,
				0,
				300,
				500
			],
			"autoorganize": 1,
			"hideprojectwindow": 1,
			"showdependencies": 1,
			"autolocalize": 0,
			"contents": {
				"patchers": {},
				"code": {}
			},
			"layout": {},
			"searchpath": {},
			"detailsvisible": 0,
			"amxdtype": 1835887981,
			"readonly": 0,
			"devpathtype": 0,
			"devpath": ".",
			"sortmode": 0,
			"viewmode": 0,
			"includepackages": 0
		},
		"autosave": 0
	}
}