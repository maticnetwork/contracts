import { makeInterfaceId } from '@openzeppelin/test-helpers'
import { assertBigNumbergt } from '../../helpers/utils'

export const InterfaceIds = {
  ERC721: 'ERC721',
  ERC165: 'ERC165',
  ERC721Enumerable: 'ERC721Enumerable',
  ERC721Metadata: 'ERC721Metadata',
  ERC721Exists: 'ERC721Exists',
  ERC1155: 'ERC1155',
  ERC1155AssetCollections: 'ERC1155AssetCollections',
  ERC1155MetadataURI: 'ERC1155MetadataURI'
}

const InterfaceMethods = {
  [InterfaceIds.ERC165]: [
    'supportsInterface(bytes4)'
  ],
  [InterfaceIds.ERC721]: [
    'balanceOf(address)',
    'ownerOf(uint256)',
    'approve(address,uint256)',
    'getApproved(uint256)',
    'setApprovalForAll(address,bool)',
    'isApprovedForAll(address,address)',
    'transferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256,bytes)'
  ],
  [InterfaceIds.ERC721Enumerable]: [
    'totalSupply()',
    'tokenOfOwnerByIndex(address,uint256)',
    'tokenByIndex(uint256)'
  ],
  [InterfaceIds.ERC721Metadata]: [
    'name()',
    'symbol()',
    'tokenURI(uint256)'
  ],
  [InterfaceIds.ERC721Exists]: [
    'exists(uint256)'
  ],
  [InterfaceIds.ERC1155]: [
    'safeTransferFrom(address,address,uint256,uint256,bytes)',
    'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
    'balanceOf(address,uint256)',
    'balanceOfBatch(address[],uint256[])',
    'setApprovalForAll(address,bool)',
    'isApprovedForAll(address,address)'
  ],
  [InterfaceIds.ERC1155AssetCollections]: [
    'ownerOf(uint256)',
    'collectionOf(uint256)',
    'isFungible(uint256)'
  ],
  [InterfaceIds.ERC1155MetadataURI]: [
    'uri(uint256)'
  ]
}

export function shouldSupportInterfaces(interfaces = []) {
  describe('ERC165\'s supportsInterface(bytes4)', function() {
    for (const k of interfaces) {
      const interfaceId = makeInterfaceId.ERC165(InterfaceMethods[k])

      describe(k, function() {
        it('should use less than 30k gas', async function() {
          assertBigNumbergt(30000, await this.contract.supportsInterface.estimateGas(interfaceId))
        })

        it('is supported', async function() {
          assert.ok(await this.contract.supportsInterface(interfaceId))
        })
      })
    }
  })
}
