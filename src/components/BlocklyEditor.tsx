/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator, Order as JSOrder } from 'blockly/javascript';
import { pythonGenerator, Order as PythonOrder } from 'blockly/python';
import { Play, Square, Code, Settings, Terminal, Activity, HelpCircle, ChevronRight, Info, Eye, Download, Upload as UploadIcon } from 'lucide-react';
import { SimulationStats } from '../types';

// Let's define the custom blocks in Blockly
// To make it easy and elegant, we initialize them once.
const BLOCKS_DEFINED = { current: false };

function defineCustomBlocks() {
  if (BLOCKS_DEFINED.current) return;
  BLOCKS_DEFINED.current = true;

  // 1. Move Forward/Backward
  Blockly.Blocks['robot_move'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_move',
        message0: 'Muovi %1 per %2 cm',
        args0: [
          {
            type: 'field_dropdown',
            name: 'DIRECTION',
            options: [
              ['AVANTI', 'FORWARD'],
              ['INDIETRO', 'BACKWARD'],
            ],
          },
          {
            type: 'field_number',
            name: 'DISTANCE',
            value: 20,
            min: 1,
            max: 200,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 230,
        tooltip: 'Muove il robot avanti o indietro della distanza specificata (in centimetri).',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_move'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const distance = Number(block.getFieldValue('DISTANCE'));
    return `await robot.move("${direction}", ${distance});\n`;
  };

  pythonGenerator.forBlock['robot_move'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const distance = Number(block.getFieldValue('DISTANCE'));
    return `robot.move("${direction}", ${distance})\n`;
  };

  // 2. Turn Left/Right
  Blockly.Blocks['robot_turn'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_turn',
        message0: 'Ruota %1 di %2 gradi',
        args0: [
          {
            type: 'field_dropdown',
            name: 'DIRECTION',
            options: [
              ['A SINISTRA ↺', 'LEFT'],
              ['A DESTRA ↻', 'RIGHT'],
            ],
          },
          {
            type: 'field_number',
            name: 'ANGLE',
            value: 90,
            min: 1,
            max: 360,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 230,
        tooltip: 'Ruota il robot a sinistra o destra dei gradi desiderati.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_turn'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const angle = Number(block.getFieldValue('ANGLE'));
    return `await robot.turn("${direction}", ${angle});\n`;
  };

  pythonGenerator.forBlock['robot_turn'] = function (block) {
    const direction = block.getFieldValue('DIRECTION');
    const angle = Number(block.getFieldValue('ANGLE'));
    return `robot.turn("${direction}", ${angle})\n`;
  };

  // 3. Stop Motors
  Blockly.Blocks['robot_stop'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_stop',
        message0: 'Ferma motori',
        previousStatement: null,
        nextStatement: null,
        colour: 230,
        tooltip: 'Arresta immediatamente il movimento di marcia del robot.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_stop'] = function () {
    return 'await robot.stop();\n';
  };

  pythonGenerator.forBlock['robot_stop'] = function () {
    return 'robot.stop()\n';
  };

  // 4. Set Speed
  Blockly.Blocks['robot_set_speed'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_set_speed',
        message0: 'Imposta velocità a %1 %',
        args0: [
          {
            type: 'field_number',
            name: 'SPEED',
            value: 80,
            min: 5,
            max: 100,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 230,
        tooltip: 'Regola la velocità massima dei motori (da 5% a 100%).',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_set_speed'] = function (block) {
    const speed = Number(block.getFieldValue('SPEED'));
    return `await robot.setSpeed(${speed});\n`;
  };

  pythonGenerator.forBlock['robot_set_speed'] = function (block) {
    const speed = Number(block.getFieldValue('SPEED'));
    return `robot.set_speed(${speed})\n`;
  };

  // 5. Arm Position
  Blockly.Blocks['robot_arm'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_arm',
        message0: '%1 braccio robotico',
        args0: [
          {
            type: 'field_dropdown',
            name: 'ACTION',
            options: [
              ['🚀 Alza', 'UP'],
              ['👇 Abbassa', 'DOWN'],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: 'Alza o abbassa il braccio per sollevare o depositare le sfere.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_arm'] = function (block) {
    const action = block.getFieldValue('ACTION');
    return `await robot.setArm("${action}");\n`;
  };

  pythonGenerator.forBlock['robot_arm'] = function (block) {
    const action = block.getFieldValue('ACTION');
    return `robot.set_arm("${action}")\n`;
  };

  // 6. Claw Action
  Blockly.Blocks['robot_claw'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_claw',
        message0: '%1 pinza della benna',
        args0: [
          {
            type: 'field_dropdown',
            name: 'ACTION',
            options: [
              ['👐 Apri', 'OPEN'],
              ['✊ Chiudi e afferra', 'CLOSE'],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: 'Apre o chiude la pinza frontale per raccogliere o rilasciare sfere.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_claw'] = function (block) {
    const action = block.getFieldValue('ACTION');
    return `await robot.setClaw("${action}");\n`;
  };

  pythonGenerator.forBlock['robot_claw'] = function (block) {
    const action = block.getFieldValue('ACTION');
    return `robot.set_claw("${action}")\n`;
  };

  // 6b. Red LED indicator
  Blockly.Blocks['robot_led_red'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_led_red',
        message0: 'Imposta LED rosso %1',
        args0: [
          {
            type: 'field_dropdown',
            name: 'STATE',
            options: [
              ['💡 ACCESO', 'ON'],
              ['🌑 SPENTO', 'OFF'],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 0, // Red Hue (0 degrees)
        tooltip: 'Accende o spegne il LED rosso posizionato in cima al robot.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_led_red'] = function (block) {
    const state = block.getFieldValue('STATE');
    return `await robot.setLedRed("${state}");\n`;
  };

  pythonGenerator.forBlock['robot_led_red'] = function (block) {
    const state = block.getFieldValue('STATE');
    return `robot.set_led_red("${state}")\n`;
  };

  // 7. Distance sensor
  Blockly.Blocks['action_sensor_distance'] = {
    init: function () {
      this.jsonInit({
        type: 'action_sensor_distance',
        message0: 'leggi sensore di distanza',
        previousStatement: null,
        nextStatement: null,
        colour: 60,
        tooltip: 'Esegue la lettura del sensore di distanza come azione indipendente.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['action_sensor_distance'] = function () {
    return 'await robot.getDistance();\n';
  };

  pythonGenerator.forBlock['action_sensor_distance'] = function () {
    return 'robot.get_distance()\n';
  };

  // 7b. Accelerometer (Inclinazione Z)
  Blockly.Blocks['action_sensor_pitch'] = {
    init: function () {
      this.jsonInit({
        type: 'action_sensor_pitch',
        message0: 'leggi accelerometro (inclinazione Z)',
        previousStatement: null,
        nextStatement: null,
        colour: 60,
        tooltip: 'Esegue la lettura dell\'accelerometro (inclinazione asse Z) come azione indipendente.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['action_sensor_pitch'] = function () {
    return 'await robot.getPitch();\n';
  };

  pythonGenerator.forBlock['action_sensor_pitch'] = function () {
    return 'robot.get_pitch()\n';
  };

  Blockly.Blocks['sensor_pitch'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_pitch',
        message0: 'valore accelerometro (inclinazione Z)',
        output: 'Number',
        colour: 60,
        tooltip: 'Restituisce l\'ultimo valore letto dall\'accelerometro per l\'inclinazione Z (beccheggio) in gradi.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_pitch'] = function () {
    return ['await robot.getPitch()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_pitch'] = function () {
    return ['robot.get_pitch()', PythonOrder.NONE];
  };

  Blockly.Blocks['sensor_distance'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_distance',
        message0: 'valore sensore di distanza',
        output: 'Number',
        colour: 60,
        tooltip: 'Restituisce l\'ultimo valore letto dal sensore in cm.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_distance'] = function () {
    return ['await robot.getDistance()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_distance'] = function () {
    return ['robot.get_distance()', PythonOrder.NONE];
  };

  // 8. Nearest sphere distance
  Blockly.Blocks['sensor_sphere_distance'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_sphere_distance',
        message0: 'distanza sfera vicina (cm)',
        output: 'Number',
        colour: 60,
        tooltip: 'Restituisce la distanza in centimetri dalla sfera più vicina.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_sphere_distance'] = function () {
    return ['await robot.getSphereDistance()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_sphere_distance'] = function () {
    return ['robot.get_sphere_distance()', PythonOrder.NONE];
  };

  // 9. Sphere Conductive Sensor
  Blockly.Blocks['sensor_sphere_conductive'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_sphere_conductive',
        message0: 'sfera vicina è conduttiva (argento)?',
        output: 'Boolean',
        colour: 60,
        tooltip: 'Restituisce VERO se la sfera più vicina (o afferrata) è di colore argento (conduttiva), FALSO altrimenti.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_sphere_conductive'] = function () {
    return ['await robot.isSphereConductive()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_sphere_conductive'] = function () {
    return ['robot.is_sphere_conductive()', PythonOrder.NONE];
  };

  // 10. Sphere Color
  Blockly.Blocks['sensor_sphere_color'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_sphere_color',
        message0: 'colore sfera vicina',
        output: 'String',
        colour: 60,
        tooltip: 'Restituisce il colore della sfera più vicina: "argento" o "nero", o "nessuno" se non ci sono sfere.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_sphere_color'] = function () {
    return ['await robot.getSphereColor()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_sphere_color'] = function () {
    return ['robot.get_sphere_color()', PythonOrder.NONE];
  };

  // 13. Color sensor 1
  Blockly.Blocks['sensor_color_1'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_color_1',
        message0: 'colore rilevato sensore colore 1',
        output: 'String',
        colour: 60,
        tooltip: 'Restituisce il colore visto dal sensore frontale (verde, rosso o bianco).',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_color_1'] = function () {
    return ['await robot.getGroundColor()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_color_1'] = function () {
    return ['robot.get_ground_color()', PythonOrder.NONE];
  };

  // 14. LuceColSx Color Sensor
  Blockly.Blocks['sensor_lucecol_sx_color'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_lucecol_sx_color',
        message0: 'colore sensore LuceColSx',
        output: 'String',
        colour: 60,
        tooltip: 'Restituisce il colore rilevato dal sensore sinistro rivolto verso il basso (bianco, nero, verde, rosso, argento).',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_lucecol_sx_color'] = function () {
    return ['await robot.getLuceColSxColor()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_lucecol_sx_color'] = function () {
    return ['robot.get_luce_col_sx_color()', PythonOrder.NONE];
  };

  // 15. LuceColSx Light Sensor
  Blockly.Blocks['sensor_lucecol_sx_light'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_lucecol_sx_light',
        message0: 'intensità luce riflessa LuceColSx',
        output: 'Number',
        colour: 60,
        tooltip: 'Restituisce l\'intensità della luce riflessa dal pavimento (0-100%%) per il sensore sinistro LuceColSx.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_lucecol_sx_light'] = function () {
    return ['await robot.getLuceColSxLight()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_lucecol_sx_light'] = function () {
    return ['robot.get_luce_col_sx_light()', PythonOrder.NONE];
  };

  // 16. LuceColDx Color Sensor
  Blockly.Blocks['sensor_lucecol_dx_color'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_lucecol_dx_color',
        message0: 'colore sensore LuceColDx',
        output: 'String',
        colour: 60,
        tooltip: 'Restituisce il colore rilevato dal sensore destro rivolto verso il basso (bianco, nero, verde, rosso, argento).',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_lucecol_dx_color'] = function () {
    return ['await robot.getLuceColDxColor()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_lucecol_dx_color'] = function () {
    return ['robot.get_luce_col_dx_color()', PythonOrder.NONE];
  };

  // 17. LuceColDx Light Sensor
  Blockly.Blocks['sensor_lucecol_dx_light'] = {
    init: function () {
      this.jsonInit({
        type: 'sensor_lucecol_dx_light',
        message0: 'intensità luce riflessa LuceColDx',
        output: 'Number',
        colour: 60,
        tooltip: 'Restituisce l\'intensità della luce riflessa dal pavimento (0-100%%) per il sensore destro LuceColDx.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['sensor_lucecol_dx_light'] = function () {
    return ['await robot.getLuceColDxLight()', JSOrder.NONE];
  };

  pythonGenerator.forBlock['sensor_lucecol_dx_light'] = function () {
    return ['robot.get_luce_col_dx_light()', PythonOrder.NONE];
  };

  // 18. Action LuceColSx Sensor
  Blockly.Blocks['action_sensor_lucecol_sx'] = {
    init: function () {
      this.jsonInit({
        type: 'action_sensor_lucecol_sx',
        message0: 'leggi sensore luce/colore sinistro',
        previousStatement: null,
        nextStatement: null,
        colour: 60,
        tooltip: 'Esegue la lettura del sensore di luce e colore sinistro (LuceColSx) come azione indipendente.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['action_sensor_lucecol_sx'] = function () {
    return 'await robot.getLuceColSxColor();\n';
  };

  pythonGenerator.forBlock['action_sensor_lucecol_sx'] = function () {
    return 'robot.get_luce_col_sx_color()\n';
  };

  // 19. Action LuceColDx Sensor
  Blockly.Blocks['action_sensor_lucecol_dx'] = {
    init: function () {
      this.jsonInit({
        type: 'action_sensor_lucecol_dx',
        message0: 'leggi sensore luce/colore destro',
        previousStatement: null,
        nextStatement: null,
        colour: 60,
        tooltip: 'Esegue la lettura del sensore di luce e colore destro (LuceColDx) come azione indipendente.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['action_sensor_lucecol_dx'] = function () {
    return 'await robot.getLuceColDxColor();\n';
  };

  pythonGenerator.forBlock['action_sensor_lucecol_dx'] = function () {
    return 'robot.get_luce_col_dx_color()\n';
  };

  // 11. Wait Delay
  Blockly.Blocks['robot_wait'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_wait',
        message0: 'attendi %1 secondi',
        args0: [
          {
            type: 'field_number',
            name: 'SECONDS',
            value: 1,
            min: 0.1,
            max: 30,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 260,
        tooltip: 'Attende il tempo impostato prima di passare al comando successivo.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_wait'] = function (block) {
    const seconds = Number(block.getFieldValue('SECONDS'));
    return `await robot.wait(${seconds});\n`;
  };

  pythonGenerator.forBlock['robot_wait'] = function (block) {
    const seconds = Number(block.getFieldValue('SECONDS'));
    return `robot.wait(${seconds})\n`;
  };

  // 12. Program Start Block
  Blockly.Blocks['robot_start'] = {
    init: function () {
      this.jsonInit({
        type: 'robot_start',
        message0: 'All\'avvio',
        nextStatement: null,
        colour: 340,
        tooltip: 'Punto di inizio del programma. Collega qui sotto i blocchi da eseguire.',
        helpUrl: '',
      });
    },
  };

  javascriptGenerator.forBlock['robot_start'] = function (block) {
    return '';
  };

  pythonGenerator.forBlock['robot_start'] = function (block) {
    return '# All\'avvio della missione\n';
  };
}

interface BlocklyEditorProps {
  onRunCode: (code: string) => void;
  onStopCode: () => void;
  isRunning: boolean;
  logs: string[];
  simulationState: string;
  onBackToSimulation?: () => void;
  onCodeChange?: (code: string) => void;
  initialXml?: string;
  onXmlChange?: (xml: string) => void;
}

export default function BlocklyEditor({
  onRunCode,
  onStopCode,
  isRunning,
  logs,
  simulationState,
  onBackToSimulation,
  onCodeChange,
  initialXml,
  onXmlChange,
}: BlocklyEditorProps) {
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'blocks' | 'code'>('blocks');

  // Custom states for dialog overlays (bypassing native dialog limitations in sandbox iframes)
  const [promptState, setPromptState] = useState<{
    message: string;
    defaultValue: string;
    callback: (val: string | null) => void;
  } | null>(null);
  const [promptInputValue, setPromptInputValue] = useState('');

  const [confirmState, setConfirmState] = useState<{
    message: string;
    callback: (confirmed: boolean) => void;
  } | null>(null);

  const [alertState, setAlertState] = useState<{
    message: string;
    callback: () => void;
  } | null>(null);

  // Helper function to safely generate code taking care of variables and procedures
  const generateValidCode = (ws: Blockly.WorkspaceSvg, type: 'js' | 'python' = 'js') => {
    const startBlocks = ws.getBlocksByType('robot_start');
    if (startBlocks.length === 0) return null;

    const generator = type === 'js' ? javascriptGenerator : pythonGenerator;
    generator.init(ws);
    
    // Explicitly generate procedure definitions which are top-level loose blocks
    const topBlocks = ws.getTopBlocks(true);
    for (const block of topBlocks) {
      if (block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn') {
        generator.blockToCode(block);
      }
    }

    const codeGen = generator.blockToCode(startBlocks[0]);
    let code = typeof codeGen === 'string' ? codeGen : (Array.isArray(codeGen) ? codeGen[0] : '');
    
    // Check for any loose blocks (not procedures and not the start block)
    let hasLooseBlocks = false;
    for (const block of topBlocks) {
      if (block.type !== 'procedures_defnoreturn' && block.type !== 'procedures_defreturn' && block.type !== 'robot_start') {
        hasLooseBlocks = true;
        break;
      }
    }
    
    if (hasLooseBlocks) {
      if (type === 'js') {
        code += '\n// ⚠️ Nota: I blocchi non collegati ad "All\'avvio" sono stati ignorati e non verranno eseguiti.';
      } else {
        code += '\n# ⚠️ Nota: I blocchi non collegati ad "All\'avvio" sono stati ignorati.';
      }
    }

    return generator.finish(code);
  };

  // Initialize Custom Blocks exactly once
  useEffect(() => {
    defineCustomBlocks();
  }, []);

  // Initialize Blockly Workspace
  useEffect(() => {
    if (!blocklyDivRef.current) return;

    // Build the XML toolbox containing categories
    const xmlToolbox = `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Eventi" colour="340">
          <block type="robot_start"></block>
        </category>

        <category name="Movimento" colour="230">
          <block type="robot_move">
            <field name="DIRECTION">FORWARD</field>
            <field name="DISTANCE">30</field>
          </block>
          <block type="robot_turn">
            <field name="DIRECTION">LEFT</field>
            <field name="ANGLE">90</field>
          </block>
          <block type="robot_stop"></block>
          <block type="robot_set_speed">
            <field name="SPEED">80</field>
          </block>
        </category>
        
        <category name="Attuatori" colour="160">
          <block type="robot_arm">
            <field name="ACTION">UP</field>
          </block>
          <block type="robot_claw">
            <field name="ACTION">CLOSE</field>
          </block>
          <block type="robot_led_red">
            <field name="STATE">ON</field>
          </block>
        </category>
        
        <category name="Sensori" colour="60">
          <block type="action_sensor_distance"></block>
          <block type="action_sensor_pitch"></block>
          <block type="action_sensor_lucecol_sx"></block>
          <block type="action_sensor_lucecol_dx"></block>
          <block type="sensor_distance"></block>
          <block type="sensor_pitch"></block>
          <block type="sensor_color_1"></block>
          <block type="sensor_lucecol_sx_color"></block>
          <block type="sensor_lucecol_sx_light"></block>
          <block type="sensor_lucecol_dx_color"></block>
          <block type="sensor_lucecol_dx_light"></block>
          <block type="sensor_sphere_distance"></block>
          <block type="sensor_sphere_conductive"></block>
          <block type="sensor_sphere_color"></block>
        </category>

        <category name="Tempo" colour="260">
          <block type="robot_wait">
            <field name="SECONDS">1</field>
          </block>
        </category>
        
        <sep></sep>
        
        <category name="Cicli" colour="120">
          <block type="controls_repeat_ext">
            <value name="TIMES">
              <shadow type="math_number">
                <field name="NUM">3</field>
              </shadow>
            </value>
          </block>
          <block type="controls_whileUntil">
            <field name="MODE">WHILE</field>
          </block>
        </category>
        
        <category name="Condizioni" colour="210">
          <block type="controls_if"></block>
          <block type="controls_if">
            <mutation else="1"></mutation>
          </block>
          <block type="logic_compare"></block>
          <block type="logic_operation"></block>
          <block type="logic_boolean"></block>
        </category>
        
        <category name="Matematica" colour="20">
          <block type="math_number">
            <field name="NUM">10</field>
          </block>
          <block type="math_arithmetic"></block>
        </category>

        <category name="Variabili" custom="VARIABLE" colour="330"></category>
        
        <category name="Procedure" custom="PROCEDURE" colour="290"></category>
      </xml>
    `;

    // Inject workspace
    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: xmlToolbox,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#334155',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      theme: Blockly.Themes.Classic, // Warm colors
    });

    workspaceRef.current = ws;

    // Custom dialog handlers to bypass sandboxed iframe prompt/alert/confirm restrictions
    if (Blockly.dialog) {
      Blockly.dialog.setPrompt((message, defaultValue, callback) => {
        setPromptState({ message, defaultValue, callback });
        setPromptInputValue(defaultValue);
      });
      Blockly.dialog.setConfirm((message, callback) => {
        setConfirmState({ message, callback });
      });
      Blockly.dialog.setAlert((message, callback) => {
        setAlertState({ message, callback });
      });
    }

    // Real-time Python output generation for display
    const onWorkspaceChange = () => {
      try {
        const python = generateValidCode(ws, 'python') || '# Trascina un blocco "All\'avvio" nel foglio di lavoro.';
        setGeneratedCode(python);
        
        // We still provide the JS version for background simulation execution if needed via prop
        if (onCodeChange) {
          const js = generateValidCode(ws, 'js') || '';
          onCodeChange(js);
        }

        // Persist XML structure
        if (onXmlChange) {
          const xml = Blockly.Xml.workspaceToDom(ws);
          const xmlText = Blockly.Xml.domToText(xml);
          onXmlChange(xmlText);
        }
      } catch (err) {
        console.warn('Blockly generation error: ', err);
      }
    };

    ws.addChangeListener(onWorkspaceChange);

    // Initial blocks: Load from initialXml if provided, else load defaults
    if (initialXml && initialXml.trim() !== "") {
      try {
        const xml = Blockly.utils.xml.textToDom(initialXml);
        Blockly.Xml.domToWorkspace(xml, ws);
      } catch (e) {
        console.warn("Loading provided initialXml failed: ", e);
      }
    } else {
      // Default blocks: Get closest silver sphere, grab it, put in GREEN
      const defaultBlocksXml = `
        <xml xmlns="https://developers.google.com/blockly/xml">
          <block type="robot_start" x="50" y="50">
            <next>
              <block type="robot_claw">
                <field name="ACTION">OPEN</field>
                <next>
                  <block type="robot_move">
                    <field name="DIRECTION">FORWARD</field>
                    <field name="DISTANCE">20</field>
                    <next>
                      <block type="robot_wait">
                        <field name="SECONDS">0.5</field>
                        <next>
                          <block type="robot_claw">
                            <field name="ACTION">CLOSE</field>
                            <next>
                              <block type="robot_arm">
                                <field name="ACTION">UP</field>
                                <next>
                                  <block type="robot_turn">
                                    <field name="DIRECTION">RIGHT</field>
                                    <field name="ANGLE">90</field>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </xml>
      `;
      try {
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(defaultBlocksXml), ws);
      } catch (e) {
        console.warn("Loading default initial blocks failed: ", e);
      }
    }

    // Resize observer to auto-fit Blockly
    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(ws);
    });
    if (blocklyDivRef.current) {
      resizeObserver.observe(blocklyDivRef.current);
    }

    return () => {
      ws.dispose();
      resizeObserver.disconnect();
    };
  }, []);

  const handleRun = () => {
    if (!workspaceRef.current) return;
    try {
      const ws = workspaceRef.current;
      const code = generateValidCode(ws);
      if (code === null) {
        alert('Trascina un blocco "All\'avvio 🚀" nel foglio di lavoro e collega le altre istruzioni sotto di esso prima di avviare il codice.');
        return;
      }
      onRunCode(code);
    } catch (err: any) {
      alert(`Errore di compilazione Blockly: ${err?.message}`);
    }
  };

  const handleSave = () => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const blob = new Blob([xmlText], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'programma_rescue_line.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const xmlText = re.target?.result as string;
        if (!workspaceRef.current || !xmlText) return;
        try {
          const xml = Blockly.utils.xml.textToDom(xmlText);
          workspaceRef.current.clear();
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        } catch (err) {
          alert('Errore nel caricamento del file. Assicurati che sia un file Blockly XML valido.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div id="blockly-panel" className="bg-slate-900 flex flex-col h-full relative overflow-hidden">
      <style>{`
        .blocklyTreeLabel {
          color: #000000 !important;
          font-weight: 700 !important;
        }
        .blocklyTreeRowContentContainer {
          color: #000000 !important;
        }
      `}</style>
      {/* Header Tabs */}
      <div className="flex bg-slate-50 px-4 py-2 border-b border-slate-200 justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-slate-900">Simulatore Rescue Line - Editor di Codice</span>
        </div>

        {/* Buttons on the Right */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSave}
            title="Salva programma su disco"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            Salva
          </button>
          <button
            onClick={handleLoad}
            title="Carica programma da disco"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:text-slate-900 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <UploadIcon className="w-4 h-4" />
            Carica
          </button>

          <div className="w-[1px] h-5 bg-slate-300 mx-1" />

          {onBackToSimulation && (
            <button
              onClick={onBackToSimulation}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Torna alla Simulazione
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 relative min-h-[400px]">
        {/* Blockly Area */}
        <div
          ref={blocklyDivRef}
          className={`absolute inset-0 transition-opacity duration-200 ${
            activeTab === 'blocks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Code Tab */}
        {activeTab === 'code' && (
          <div className="absolute inset-0 bg-slate-950 p-4 overflow-auto flex flex-col font-mono text-xs text-indigo-300">
            <div className="flex justify-between items-center mb-2 text-slate-500 border-b border-slate-900 pb-2">
              <span>Compilatore Python Blockly v3.0</span>
              <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-400">READ-ONLY</span>
            </div>
            <pre className="flex-1 whitespace-pre-wrap leading-relaxed select-all">
              {generatedCode ? generatedCode : '# Trascina dei blocchi nel foglio per generare codice corrispondente.'}
            </pre>
          </div>
        )}
      </div>

      {/* Custom Prompt Dialog Overlay */}
      {promptState && (
        <div id="blockly-custom-prompt" className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-905 border border-slate-700 bg-slate-900 rounded-xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              {promptState.message}
            </h3>
            <input
              type="text"
              autoFocus
              value={promptInputValue}
              onChange={(e) => setPromptInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = promptInputValue;
                  setPromptState(null);
                  promptState.callback(val);
                } else if (e.key === 'Escape') {
                  setPromptState(null);
                  promptState.callback(null);
                }
              }}
              className="bg-slate-950 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setPromptState(null);
                  promptState.callback(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-semibold active:scale-95 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  const val = promptInputValue;
                  setPromptState(null);
                  promptState.callback(val);
                }}
                className="bg-indigo-600 hover:bg-indigo-505 text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg font-bold active:scale-95 transition-all cursor-pointer"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog Overlay */}
      {confirmState && (
        <div id="blockly-custom-confirm" className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              Richiesta di Conferma
            </h3>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{confirmState.message}</p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setConfirmState(null);
                  confirmState.callback(false);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-semibold active:scale-95 transition-all cursor-pointer"
              >
                No
              </button>
              <button
                onClick={() => {
                  setConfirmState(null);
                  confirmState.callback(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold active:scale-95 transition-all cursor-pointer"
              >
                Sì, procedi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Dialog Overlay */}
      {alertState && (
        <div id="blockly-custom-alert" className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              Notifica di Sistema
            </h3>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{alertState.message}</p>
            <div className="flex justify-end text-xs">
              <button
                onClick={() => {
                  setAlertState(null);
                  alertState.callback();
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-1.5 rounded-lg font-bold active:scale-95 transition-all cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
