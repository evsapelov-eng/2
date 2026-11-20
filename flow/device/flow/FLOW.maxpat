{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 8,
			"minor": 6,
			"revision": 4,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [
			60.0,
			60.0,
			1300.0,
			960.0
		],
		"openrect": [
			0.0,
			0.0,
			640.0,
			169.0
		],
		"bglocked": 0,
		"openinpresentation": 1,
		"default_fontsize": 10.0,
		"default_fontface": 0,
		"default_fontname": "Arial Bold",
		"gridonopen": 1,
		"gridsize": [
			8.0,
			8.0
		],
		"boxanimatetime": 500,
		"devicewidth": 0.0,
		"description": "FLOW Performance Arranger (Milestone 1, UNVERIFIED)",
		"digest": "",
		"tags": "",
		"style": "",
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						20.0,
						20.0,
						105.0,
						22.0
					],
					"outlettype": [
						"bang",
						"int",
						"int"
					],
					"text": "live.thisdevice"
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						50.0,
						56.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "deferlow"
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						80.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "init"
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						20.0,
						600.0,
						200.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "js flow.js",
					"saved_object_attributes": {
						"filename": "flow.js",
						"parameter_enable": 0
					}
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						900.0,
						20.0,
						42.0,
						22.0
					],
					"outlettype": [
						"int"
					],
					"text": "midiin"
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						900.0,
						60.0,
						49.0,
						22.0
					],
					"text": "midiout"
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						400.0,
						660.0,
						91.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						""
					],
					"text": "pattr flowdoc",
					"varname": "flowdoc",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_invisible": 1,
							"parameter_longname": "FLOW Document",
							"parameter_shortname": "FLOW Doc",
							"parameter_type": 3
						}
					},
					"saved_object_attributes": {
						"parameter_enable": 1,
						"parameter_mappable": 0
					}
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						400.0,
						700.0,
						126.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend restoredoc"
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 14,
					"patching_rect": [
						20.0,
						640.0,
						600.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"text": "route state current bar next msg set test ui_nav ui_quant ui_hold ui_jump ui_stop ui_follow"
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						2.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 11.0,
					"fontface": 1,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.722,
						0.886,
						0.541,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						140.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						140.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						20.0,
						300.0,
						28.0
					],
					"ignoreclick": 1,
					"fontsize": 20.0,
					"fontface": 1,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.851,
						0.878,
						0.875,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						260.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-15",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						260.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						50.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 11.0,
					"fontface": 0,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.851,
						0.878,
						0.875,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						380.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						380.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						68.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 11.0,
					"fontface": 0,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.851,
						0.878,
						0.875,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						500.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						500.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						86.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0,
					"fontface": 0,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.847,
						0.549,
						0.467,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						620.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						620.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						104.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0,
					"fontface": 0,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						740.0,
						680.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						740.0,
						720.0,
						110.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						122.0,
						300.0,
						16.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0,
					"fontface": 0,
					"bgcolor": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgcolor2": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"bgfillcolor_color": [
						0.075,
						0.086,
						0.098,
						1.0
					],
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						300.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "HOLD",
					"presentation": 1,
					"presentation_rect": [
						310.0,
						2.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "HOLD",
					"varname": "FLOW HOLD",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW HOLD",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "HOLD",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						300.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						300.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						300.0,
						240.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "hold"
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						400.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "RELEASE",
					"presentation": 1,
					"presentation_rect": [
						392.0,
						2.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "RELEASE",
					"varname": "FLOW RELEASE",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW RELEASE",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "RELEASE",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						400.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						400.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-31",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						400.0,
						240.0,
						49.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "release"
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						500.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "PREV",
					"presentation": 1,
					"presentation_rect": [
						310.0,
						42.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "PREV",
					"varname": "FLOW PREV",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW PREV",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "PREV",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-33",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						500.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-34",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						500.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-35",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						500.0,
						240.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prev"
				}
			},
			{
				"box": {
					"id": "obj-36",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						600.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "NEXT",
					"presentation": 1,
					"presentation_rect": [
						392.0,
						42.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "NEXT",
					"varname": "FLOW NEXT",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW NEXT",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "NEXT",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-37",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						600.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-38",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						600.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-39",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						600.0,
						240.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "next"
				}
			},
			{
				"box": {
					"id": "obj-40",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						700.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "STOP",
					"presentation": 1,
					"presentation_rect": [
						310.0,
						82.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "STOP",
					"varname": "FLOW STOP",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW STOP",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "STOP",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-41",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						700.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-42",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						700.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-43",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						240.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "stop"
				}
			},
			{
				"box": {
					"id": "obj-44",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						800.0,
						120.0,
						80.0,
						36.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "CANCEL",
					"presentation": 1,
					"presentation_rect": [
						392.0,
						82.0,
						80.0,
						37.0
					],
					"parameter_enable": 1,
					"mode": 0,
					"texton": "CANCEL",
					"varname": "FLOW CANCEL",
					"fontsize": 13.0,
					"fontface": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_button_mode": "Momentary",
							"parameter_enum": [
								"val1",
								"val2"
							],
							"parameter_longname": "FLOW CANCEL",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "CANCEL",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-45",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						800.0,
						170.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						""
					],
					"text": "route bang"
				}
			},
			{
				"box": {
					"id": "obj-46",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"patching_rect": [
						800.0,
						200.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang",
						""
					],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-47",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						800.0,
						240.0,
						42.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "cancel"
				}
			},
			{
				"box": {
					"id": "obj-48",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						300.0,
						60.0,
						20.0
					],
					"text": "NAV",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						2.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-49",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						300.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						3.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Nav",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"SETLIST",
								"SOURCE"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Nav",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "Nav",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-50",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						300.0,
						105.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend navmode"
				}
			},
			{
				"box": {
					"id": "obj-51",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						330.0,
						60.0,
						20.0
					],
					"text": "NEXT AT",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						21.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-52",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						330.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						22.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Next At",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"1 BAR",
								"2 BARS",
								"4 BARS",
								"8 BARS",
								"SECTION"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Next At",
							"parameter_mmax": 4,
							"parameter_modmode": 0,
							"parameter_shortname": "Next At",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-53",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						330.0,
						91.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend quant"
				}
			},
			{
				"box": {
					"id": "obj-54",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						360.0,
						60.0,
						20.0
					],
					"text": "HOLD",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						40.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-55",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						360.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						41.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Hold",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"SECTION",
								"LAST 1",
								"LAST 2",
								"LAST 4",
								"LAST 8"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Hold",
							"parameter_mmax": 4,
							"parameter_modmode": 0,
							"parameter_shortname": "Hold",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-56",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						360.0,
						105.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend holdlen"
				}
			},
			{
				"box": {
					"id": "obj-57",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						390.0,
						60.0,
						20.0
					],
					"text": "JUMPS",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						59.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-58",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						390.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						60.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Jumps",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"SAFE",
								"EXPERIMENTAL"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Jumps",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "Jumps",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-59",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						390.0,
						112.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend jumpmode"
				}
			},
			{
				"box": {
					"id": "obj-60",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						420.0,
						60.0,
						20.0
					],
					"text": "STOP",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						78.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-61",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						420.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						79.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Stop",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"CONFIRM",
								"IMMEDIATE"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Stop",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "Stop",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-62",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						420.0,
						112.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend stopmode"
				}
			},
			{
				"box": {
					"id": "obj-63",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						700.0,
						450.0,
						60.0,
						20.0
					],
					"text": "SETLIST",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						97.0,
						58.0,
						17.0
					],
					"fontsize": 9.0,
					"textcolor": [
						0.49,
						0.541,
						0.549,
						1.0
					]
				}
			},
			{
				"box": {
					"id": "obj-64",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						770.0,
						450.0,
						100.0,
						18.0
					],
					"outlettype": [
						"",
						"",
						"float"
					],
					"presentation": 1,
					"presentation_rect": [
						534.0,
						98.0,
						102.0,
						16.0
					],
					"parameter_enable": 1,
					"varname": "FLOW Setlist",
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_enum": [
								"FOLLOW",
								"PAUSE"
							],
							"parameter_invisible": 2,
							"parameter_longname": "FLOW Setlist",
							"parameter_mmax": 1,
							"parameter_modmode": 0,
							"parameter_shortname": "Setlist",
							"parameter_type": 2
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-65",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						880.0,
						450.0,
						98.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend follow"
				}
			},
			{
				"box": {
					"id": "obj-66",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						800.0,
						105.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "import_locators",
					"presentation": 1,
					"presentation_rect": [
						4.0,
						142.0,
						76.0,
						13.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-67",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						130.0,
						800.0,
						98.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "confirm_import",
					"presentation": 1,
					"presentation_rect": [
						82.0,
						142.0,
						76.0,
						13.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-68",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						240.0,
						800.0,
						40.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "undo",
					"presentation": 1,
					"presentation_rect": [
						160.0,
						142.0,
						70.0,
						13.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-69",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						350.0,
						800.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "back_to_arr",
					"presentation": 1,
					"presentation_rect": [
						232.0,
						142.0,
						72.0,
						13.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-70",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						460.0,
						800.0,
						63.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "self_test",
					"presentation": 1,
					"presentation_rect": [
						310.0,
						124.0,
						80.0,
						16.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-71",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						570.0,
						800.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "save_report",
					"presentation": 1,
					"presentation_rect": [
						392.0,
						124.0,
						80.0,
						16.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-72",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						570.0,
						830.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang"
					],
					"text": "t b"
				}
			},
			{
				"box": {
					"id": "obj-73",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						570.0,
						860.0,
						105.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						"bang"
					],
					"text": "savedialog TEXT"
				}
			},
			{
				"box": {
					"id": "obj-74",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						570.0,
						890.0,
						126.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend savereport"
				}
			},
			{
				"box": {
					"id": "obj-75",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						680.0,
						800.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "export_json",
					"presentation": 1,
					"presentation_rect": [
						310.0,
						144.0,
						80.0,
						16.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-76",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						680.0,
						830.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang"
					],
					"text": "t b"
				}
			},
			{
				"box": {
					"id": "obj-77",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						680.0,
						860.0,
						105.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						"bang"
					],
					"text": "savedialog TEXT"
				}
			},
			{
				"box": {
					"id": "obj-78",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						680.0,
						890.0,
						126.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend exportjson"
				}
			},
			{
				"box": {
					"id": "obj-79",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						790.0,
						800.0,
						77.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "import_json",
					"presentation": 1,
					"presentation_rect": [
						392.0,
						144.0,
						80.0,
						16.0
					],
					"fontsize": 9.0
				}
			},
			{
				"box": {
					"id": "obj-80",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						790.0,
						830.0,
						40.0,
						22.0
					],
					"outlettype": [
						"bang"
					],
					"text": "t b"
				}
			},
			{
				"box": {
					"id": "obj-81",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						790.0,
						860.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						"bang"
					],
					"text": "opendialog"
				}
			},
			{
				"box": {
					"id": "obj-82",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						790.0,
						890.0,
						126.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend importjson"
				}
			},
			{
				"box": {
					"id": "obj-83",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						900.0,
						800.0,
						63.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "take_over",
					"presentation": 1,
					"presentation_rect": [
						476.0,
						124.0,
						160.0,
						16.0
					],
					"fontsize": 9.0
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": [
						"obj-1",
						0
					],
					"destination": [
						"obj-2",
						0
					]
				}
			},
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
						"obj-4",
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
						"obj-4",
						1
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
						"obj-8",
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
						"obj-4",
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
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
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
						"obj-11",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						1
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
						"obj-13",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
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
						"obj-9",
						3
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
						"obj-17",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						4
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
						"obj-19",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						5
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
						"obj-21",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						6
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
						"obj-23",
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
						"obj-25",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-25",
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
						"obj-25",
						1
					],
					"destination": [
						"obj-26",
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-28",
						0
					],
					"destination": [
						"obj-29",
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
						"obj-31",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-29",
						1
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
						"obj-31",
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
						"obj-4",
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
						"obj-33",
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
						"obj-35",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-33",
						1
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
						"obj-35",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-35",
						0
					],
					"destination": [
						"obj-4",
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
						"obj-39",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-37",
						1
					],
					"destination": [
						"obj-38",
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
						"obj-4",
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
						"obj-43",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-41",
						1
					],
					"destination": [
						"obj-42",
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
						"obj-4",
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
						"obj-47",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-45",
						1
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
						"obj-4",
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
						"obj-50",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-50",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						7
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
						"obj-52",
						0
					],
					"destination": [
						"obj-53",
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						8
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						9
					],
					"destination": [
						"obj-55",
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
						"obj-59",
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						10
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						11
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
						"obj-64",
						0
					],
					"destination": [
						"obj-65",
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
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						12
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
						"obj-66",
						0
					],
					"destination": [
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-81",
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
						"obj-4",
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
						"obj-4",
						0
					]
				}
			}
		],
		"parameters": {
			"obj-7": [
				"FLOW Document",
				"FLOW Doc",
				0
			],
			"obj-24": [
				"FLOW HOLD",
				"HOLD",
				0
			],
			"obj-28": [
				"FLOW RELEASE",
				"RELEASE",
				0
			],
			"obj-32": [
				"FLOW PREV",
				"PREV",
				0
			],
			"obj-36": [
				"FLOW NEXT",
				"NEXT",
				0
			],
			"obj-40": [
				"FLOW STOP",
				"STOP",
				0
			],
			"obj-44": [
				"FLOW CANCEL",
				"CANCEL",
				0
			],
			"obj-49": [
				"FLOW Nav",
				"Nav",
				0
			],
			"obj-52": [
				"FLOW Next At",
				"Next At",
				0
			],
			"obj-55": [
				"FLOW Hold",
				"Hold",
				0
			],
			"obj-58": [
				"FLOW Jumps",
				"Jumps",
				0
			],
			"obj-61": [
				"FLOW Stop",
				"Stop",
				0
			],
			"obj-64": [
				"FLOW Setlist",
				"Setlist",
				0
			],
			"inherited_shortname": 1
		},
		"dependency_cache": [],
		"latency": 0,
		"is_mpe": 0,
		"external_mpe_tuning_enabled": 0,
		"minimum_live_version": "",
		"minimum_max_version": "",
		"platform_compatibility": 0,
		"project": {
			"version": 1,
			"creationdate": 3590052493,
			"modificationdate": 3590052493,
			"viewrect": [
				0.0,
				0.0,
				300.0,
				500.0
			],
			"autoorganize": 1,
			"hideprojectwindow": 1,
			"showdependencies": 1,
			"autolocalize": 0,
			"contents": {
				"patchers": {}
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
