import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('n8n Integration: Workflow template is valid JSON with complete AI agent pipeline', () => {
  const templatePath = path.resolve(process.cwd(), 'templates/n8n-whatsapp-ai-agent.json');
  assert.strictEqual(fs.existsSync(templatePath), true, 'Workflow template file must exist');

  const content = fs.readFileSync(templatePath, 'utf8');
  const parsed = JSON.parse(content);

  assert.ok(parsed.name.includes('WhatsApp AI Gateway'), 'Template name should reference WhatsApp AI Gateway');
  assert.ok(Array.isArray(parsed.nodes), 'Template should have nodes array');
  assert.ok(parsed.nodes.length >= 4, 'Template should contain complete pipeline');

  // Verify key nodes exist
  const nodeTypes = parsed.nodes.map((n: any) => n.type);
  assert.ok(nodeTypes.some((t: string) => t.includes('webhook')), 'Should include webhook trigger');
  assert.ok(nodeTypes.some((t: string) => t.includes('agent')), 'Should include AI agent node');
});

test('n8n Integration: Community node package is properly configured and compiled', () => {
  const pkgDir = path.resolve(process.cwd(), 'packages/n8n-nodes-whatsapp-ai-gateway');
  assert.strictEqual(fs.existsSync(pkgDir), true, 'Community node package directory must exist');

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  assert.strictEqual(pkg.name, 'n8n-nodes-whatsapp-ai-gateway');
  assert.ok(pkg.n8n, 'Must have n8n metadata object');
  assert.ok(Array.isArray(pkg.n8n.credentials), 'Must declare credentials');
  assert.ok(Array.isArray(pkg.n8n.nodes), 'Must declare nodes');

  // Verify compiled artifacts
  const credJs = path.join(pkgDir, pkg.n8n.credentials[0]);
  const nodeJs1 = path.join(pkgDir, pkg.n8n.nodes[0]);
  const nodeJs2 = path.join(pkgDir, pkg.n8n.nodes[1]);

  assert.strictEqual(fs.existsSync(credJs), true, 'Compiled credentials JS must exist');
  assert.strictEqual(fs.existsSync(nodeJs1), true, 'Compiled action node JS must exist');
  assert.strictEqual(fs.existsSync(nodeJs2), true, 'Compiled trigger node JS must exist');
});

test('n8n Community Node: Action node provides all 6 Evolution-API-grade resources (including Group)', async () => {
  const pkgDir = path.resolve(process.cwd(), 'packages/n8n-nodes-whatsapp-ai-gateway');
  const actionNodePath = path.join(pkgDir, 'dist/nodes/WhatsAppAiGateway/WhatsAppAiGateway.node.js');
  const fileUrl = pathToFileURL(actionNodePath).href;
  const nodeModule = await import(fileUrl);
  const NodeClass = nodeModule.WhatsAppAiGateway;
  assert.ok(NodeClass, 'WhatsAppAiGateway class should exist');

  const instance = new NodeClass();
  assert.strictEqual(instance.description.name, 'whatsAppAiGateway');

  // Verify resources
  const resourceProp = instance.description.properties.find((p: any) => p.name === 'resource');
  assert.ok(resourceProp, 'Should contain resource selector property');

  const resourceValues = resourceProp.options.map((o: any) => o.value);
  assert.ok(resourceValues.includes('message'), 'Must include message resource');
  assert.ok(resourceValues.includes('group'), 'Must include group resource');
  assert.ok(resourceValues.includes('instance'), 'Must include instance resource');
  assert.ok(resourceValues.includes('chat'), 'Must include chat resource');
  assert.ok(resourceValues.includes('webhook'), 'Must include webhook resource');
  assert.ok(resourceValues.includes('mediaAi'), 'Must include mediaAi resource');
});

test('n8n Community Node: Trigger node provides advanced filters and webhook listener', async () => {
  const pkgDir = path.resolve(process.cwd(), 'packages/n8n-nodes-whatsapp-ai-gateway');
  const triggerNodePath = path.join(pkgDir, 'dist/nodes/WhatsAppAiGatewayTrigger/WhatsAppAiGatewayTrigger.node.js');
  const fileUrl = pathToFileURL(triggerNodePath).href;
  const nodeModule = await import(fileUrl);
  const TriggerClass = nodeModule.WhatsAppAiGatewayTrigger;
  assert.ok(TriggerClass, 'WhatsAppAiGatewayTrigger class should exist');

  const instance = new TriggerClass();
  assert.strictEqual(instance.description.name, 'whatsAppAiGatewayTrigger');
  assert.strictEqual(instance.description.group.includes('trigger'), true);

  const propNames = instance.description.properties.map((p: any) => p.name);
  assert.ok(propNames.includes('eventFilter'), 'Must have eventFilter property');
  assert.ok(propNames.includes('instanceFilter'), 'Must have instanceFilter property');
  assert.ok(propNames.includes('ignoreOutbound'), 'Must have ignoreOutbound property');
  assert.ok(propNames.includes('ignoreGroups'), 'Must have ignoreGroups property');
  assert.ok(propNames.includes('onlyMedia'), 'Must have onlyMedia property');
});
