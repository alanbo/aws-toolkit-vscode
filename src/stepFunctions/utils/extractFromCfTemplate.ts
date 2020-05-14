import {
    ASTNode,
    ObjectASTNode,
    PropertyASTNode,
    getLanguageService,
    TextDocument as ASLTextDocument,
} from 'amazon-states-language-service'

import * as vscode from 'vscode'
const languageService = getLanguageService({})

interface IStateMachineData {
    name: string
    definition: string
    range: vscode.Range
}

const STATE_MACHINE_TYPES = ['AWS::Serverless::StateMachine', 'AWS::StepFunctions::StateMachine']

export function isObjectNode(node?: ASTNode): node is ObjectASTNode {
    return node?.type === 'object'
}

export function isPropertyNode(node?: ASTNode): node is PropertyASTNode {
    return node?.type === 'property'
}

function getPath(node: ObjectASTNode, path: string[]): PropertyASTNode | null {
    const pathClone = [...path]

    if (isObjectNode(node)) {
        const firstOfPath = pathClone.shift()
        const pathProp = node.properties.find(prop => prop.keyNode.value === firstOfPath)

        if (pathProp) {
            if (pathClone.length === 0) {
                return pathProp
            }

            if (isObjectNode(pathProp.valueNode)) {
                return getPath(pathProp.valueNode, pathClone)
            }
        }
    }

    return null
}

export default function extractStateMachinesFromCfTemplate(textDocument: vscode.TextDocument): IStateMachineData[] {
    const text = textDocument.getText()
    const doc = ASLTextDocument.create(textDocument.uri.path, textDocument.languageId, textDocument.version, text)
    // tslint:disable-next-line: no-inferred-empty-object-type
    const jsonDocument = languageService.parseJSONDocument(doc) as { root?: ASTNode }

    if (isObjectNode(jsonDocument.root)) {
        const resources = jsonDocument?.root?.properties?.find(prop => {
            return prop.keyNode.value === 'Resources'
        })?.valueNode

        if (isObjectNode(resources)) {
            const stateMachineNodes = resources.properties.filter(resourceProperty => {
                const resourceValueNode = resourceProperty.valueNode

                if (isObjectNode(resourceValueNode)) {
                    const stateMachine = resourceValueNode.properties.find(item => {
                        const isTypeProp = item.keyNode.value === 'Type'
                        const isStateMachineValue = STATE_MACHINE_TYPES.includes(item.valueNode?.value as any)

                        return isTypeProp && isStateMachineValue
                    })

                    return !!stateMachine
                }

                return false
            })

            return stateMachineNodes.map(stateMachineNode => {
                const { offset, colonOffset } = stateMachineNode

                const startPos = textDocument.positionAt(offset)
                const endPos = textDocument.positionAt(offset + colonOffset!)

                let definition = ''

                if (isObjectNode(stateMachineNode.valueNode)) {
                    const definitionNode = getPath(stateMachineNode.valueNode, ['Properties', 'Definition'])
                    const defStart = definitionNode?.valueNode?.offset ?? 0
                    const defEnd = defStart + (definitionNode?.valueNode?.length ?? 0)
                    definition = text.slice(defStart, defEnd)
                }

                return {
                    definition,
                    name: stateMachineNode.keyNode.value,
                    range: new vscode.Range(startPos, endPos),
                }
            })
        }
    }

    return []
}
