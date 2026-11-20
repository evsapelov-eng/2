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
			80.0,
			80.0,
			1200.0,
			640.0
		],
		"openrect": [
			0.0,
			0.0,
			760.0,
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
		"description": "FLOW Milestone 0 Live API spike (UNVERIFIED)",
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
						100.0,
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
						60.0,
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
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						420.0,
						160.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "js flow_spike.js",
					"saved_object_attributes": {
						"filename": "flow_spike.js",
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
						600.0,
						20.0,
						50.0,
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
						600.0,
						60.0,
						55.0,
						22.0
					],
					"text": "midiout"
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 5,
					"patching_rect": [
						20.0,
						460.0,
						200.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						"",
						"",
						""
					],
					"text": "route pos loop exp warn"
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						500.0,
						70.0,
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
					"id": "obj-9",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						20.0,
						540.0,
						140.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						2.0,
						400.0,
						17.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						170.0,
						500.0,
						70.0,
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
						170.0,
						540.0,
						140.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						20.0,
						400.0,
						17.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						320.0,
						500.0,
						70.0,
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
						320.0,
						540.0,
						140.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						38.0,
						400.0,
						17.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						470.0,
						500.0,
						70.0,
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
						470.0,
						540.0,
						140.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "-",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						56.0,
						400.0,
						17.0
					],
					"ignoreclick": 1,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400.0,
						600.0,
						300.0,
						20.0
					],
					"text": "FLOW M0 SPIKE - UNVERIFIED - not for stage use",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						76.0,
						400.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						300.0,
						20.0,
						60.0,
						20.0
					],
					"text": "target bar",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						96.0,
						58.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "number",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						300.0,
						50.0,
						50.0,
						22.0
					],
					"outlettype": [
						"",
						"bang"
					],
					"presentation": 1,
					"presentation_rect": [
						60.0,
						96.0,
						44.0,
						17.0
					],
					"minimum": 1,
					"parameter_enable": 0,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						300.0,
						80.0,
						90.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend target"
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						420.0,
						20.0,
						60.0,
						20.0
					],
					"text": "cue #",
					"presentation": 1,
					"presentation_rect": [
						112.0,
						96.0,
						58.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "number",
					"numinlets": 1,
					"numoutlets": 2,
					"patching_rect": [
						420.0,
						50.0,
						50.0,
						22.0
					],
					"outlettype": [
						"",
						"bang"
					],
					"presentation": 1,
					"presentation_rect": [
						170.0,
						96.0,
						44.0,
						17.0
					],
					"minimum": 0,
					"parameter_enable": 0,
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						420.0,
						80.0,
						90.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend cueindex"
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						520.0,
						20.0,
						60.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "save log",
					"presentation": 1,
					"presentation_rect": [
						2.0,
						118.0,
						100.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"patching_rect": [
						520.0,
						50.0,
						70.0,
						22.0
					],
					"outlettype": [
						"",
						"",
						""
					],
					"text": "savedialog"
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"patching_rect": [
						520.0,
						80.0,
						100.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "prepend savelog"
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						20.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "read",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						2.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						20.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "cuelist",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						2.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						20.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "play",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						2.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						50.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "stop",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						20.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						50.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "loopon",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						20.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-31",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						50.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "loopoff",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						20.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						80.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "restore",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						38.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-33",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						80.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "backtoarr",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						38.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-34",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						80.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "abort",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						38.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-35",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						110.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "seek",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						56.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-36",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						110.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "cuejump",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						56.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-37",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						110.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_rates 10",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						56.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-38",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						140.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_bars",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						74.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-39",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						140.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_hold 1",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						74.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-40",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						140.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_hold 4",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						74.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-41",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						170.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_release",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						92.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-42",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						170.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_release_sweep 1 3",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						92.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-43",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						170.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_hold_sweep 1 2",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						92.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-44",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						200.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_seek",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						110.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-45",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						200.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_cuejump",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						110.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-46",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						200.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_wrapjump",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						110.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-47",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						230.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "exp_notifyset",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						128.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-48",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						230.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "poll 1",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						128.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-49",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						230.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "poll 0",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						128.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-50",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						700.0,
						260.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "verbose 1",
					"presentation": 1,
					"presentation_rect": [
						408.0,
						146.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-51",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						830.0,
						260.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "verbose 0",
					"presentation": 1,
					"presentation_rect": [
						526.0,
						146.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-52",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"patching_rect": [
						960.0,
						260.0,
						120.0,
						22.0
					],
					"outlettype": [
						""
					],
					"text": "clearlog",
					"presentation": 1,
					"presentation_rect": [
						644.0,
						146.0,
						116.0,
						17.0
					],
					"fontsize": 10.0
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
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						1
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
						"obj-7",
						2
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
						"obj-7",
						3
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
						"obj-19",
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
						"obj-21",
						0
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-4",
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
						"obj-48",
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
						"obj-4",
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
						"obj-51",
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
						"obj-52",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			}
		],
		"parameters": {},
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
