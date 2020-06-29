import { expectRevert } from '@openzeppelin/test-helpers'
import { assertBigNumberEquality } from '../../../helpers/utils'

const SignerListTest = artifacts.require('SignerListTest')

const MAX_BUCKET_SIZE = 10

function initRandom(seed) {
  return function random() {
    var x = Math.sin(seed++) * 10000
    return x - Math.floor(x)
  }
}

contract('SignerList', function() {
  function testBucket({ bucketId, bucketSize, bucketIndex, elements }) {
    it(`bucket with id ${bucketId} must have size ${bucketSize}`, async function() {
      this.bucket = await this.signerList.getBucketById(bucketId)
      assertBigNumberEquality(this.bucket.size, bucketSize)
    })

    if (elements) {
      let index = 0
      for (const el of elements) {
        const idx = index
        it(`element at ${index} must be ${el}`, function() {
          assertBigNumberEquality(this.bucket.elements[idx], el)
        })
        index++
      }
    } else {
      it('must have correct elements', function() {
        if (!this.targetElements) {
          this.skip()
        }

        let index = 0
        for (const el of this.targetElements) {
          assertBigNumberEquality(this.bucket.elements[index], el)
          index++
        }
      })
    }

    it(`must get bucket id ${bucketId} at index ${bucketIndex}`, async function() {
      assertBigNumberEquality(await this.signerList.getBucketIdByIndex(bucketIndex), bucketId)
    })
  }

  describe('searching suitable bucket', function() {
    function testFindBucket({ signer, bucketId, bucketIndex, bucketSize }) {
      it('must find bucket with correct id', async function() {
        this.bucket = await this.signerList.findBucket(signer)
        assertBigNumberEquality(this.bucket[2], bucketId)
      })

      it('with correct size', function() {
        assertBigNumberEquality(this.bucket[0], bucketSize)
      })

      it('with correct index', function() {
        assertBigNumberEquality(this.bucket[1], bucketIndex)
      })

      it('must have correct elements', async function() {
        const bucket = await this.signerList.getBucketById(bucketId)
        let index = 0
        for (const el of this.targetElements) {
          assertBigNumberEquality(bucket.elements[index], el)
          index++
        }
      })
    }

    describe('when list is empty', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()
        this.targetElements = []
      })

      testFindBucket({
        signer: 3,
        bucketId: 0,
        bucketIndex: 0,
        bucketSize: 0
      })
    })

    describe('when 1 element was inserted', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()
        await this.signerList.insert(1)
        this.targetElements = [1]
      })

      testFindBucket({
        signer: 2,
        bucketId: 1,
        bucketIndex: 0,
        bucketSize: 1
      })
    })

    describe('when searching with 1 bucket', function() {
      describe('when bucket is not full', function() {
        before(async function() {
          this.signerList = await SignerListTest.new()
          this.targetElements = []

          for (let i = 0; i < MAX_BUCKET_SIZE / 2; ++i) {
            await this.signerList.insert(i * 2 + 1)
            this.targetElements.push(i * 2 + 1)
          }
        })

        describe('when element falls inside the bucket range', function() {
          testFindBucket({
            signer: 2,
            bucketId: 1,
            bucketIndex: 0,
            bucketSize: MAX_BUCKET_SIZE / 2
          })
        })

        describe('when element is smaller than bucket range', function() {
          testFindBucket({
            signer: 0,
            bucketId: 1,
            bucketIndex: 0,
            bucketSize: MAX_BUCKET_SIZE / 2
          })
        })
      })

      describe('when bucket is full', function() {
        before(async function() {
          this.signerList = await SignerListTest.new()
          this.targetElements = []

          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(i * 2 + 1)
            this.targetElements.push(i * 2 + 1)
          }
        })
        // must point to the full bucket
        testFindBucket({
          signer: 2,
          bucketId: 1,
          bucketIndex: 0,
          bucketSize: MAX_BUCKET_SIZE
        })
      })
    })

    describe('3 buckets. Signer fits within 2nd bucket range.', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()
        this.targetElements = []

        let element = 1
        for (let k = 1; k <= 3; ++k) {
          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(element)

            if (k === 2) {
              // if second bucket - save it for evaluation
              this.targetElements.push(element)
            }

            element += 2
          }
        }
      })

      testFindBucket({
        signer: 22,
        bucketId: 2,
        bucketIndex: 1,
        bucketSize: MAX_BUCKET_SIZE
      })
    })
  })

  describe('insertSigner', function() {
    function testInsertSigner({ signer, bucketId, bucketSize, bucketIndex, totalBuckets, elements }) {
      it(`must insert ${signer}`, async function() {
        await this.signerList.insert(signer)
      })

      testBucket({ bucketId, bucketSize, bucketIndex, elements })

      it(`must have total ${totalBuckets} buckets`, async function() {
        assertBigNumberEquality(await this.signerList.getTotalBuckets(), totalBuckets)
      })
    }

    describe('when list is empty', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()
        this.targetElements = [1]
      })

      testInsertSigner({
        signer: 1,
        bucketId: 1,
        bucketSize: 1,
        bucketIndex: 0,
        totalBuckets: 1
      })
    })

    describe('when list has 1 element', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()
        this.targetElements = [1, 2]

        await this.signerList.insert(1)
      })

      testInsertSigner({
        signer: 2,
        bucketId: 1,
        bucketSize: 2,
        bucketIndex: 0,
        totalBuckets: 1
      })
    })

    describe(`when list has 1 full bucket`, function() {
      describe('when signer is greater than last element', function() {
        before(async function() {
          this.signerList = await SignerListTest.new()

          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(i + 1)
          }
        })

        testInsertSigner({
          signer: 999,
          bucketId: 2,
          bucketSize: 1,
          bucketIndex: 1,
          totalBuckets: 2,
          elements: [999]
        })
      })

      describe('when signer is less than last element', function() {
        let elements = []
        let testElements = []
        let element = 2
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          elements.push(element)
          testElements.push(element)
          element += 2
        }

        // replace second element and remove last
        testElements.splice(1, 0, 3)
        testElements.pop()

        const testElements2 = [...testElements]
        testElements2.splice(3, 0, 5)
        testElements2.pop()

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(elements[i])
          }
        })

        describe('inserting 1st element', function() {
          testInsertSigner({
            signer: 3,
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 0,
            totalBuckets: 2,
            elements: testElements
          })
        })

        describe('after', function() {
          testBucket({
            bucketId: 2,
            bucketIndex: 1,
            bucketSize: 1,
            elements: [MAX_BUCKET_SIZE * 2]
          })
        })

        describe('inserting 2nd element', function() {
          testInsertSigner({
            signer: 5,
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 0,
            totalBuckets: 2,
            elements: testElements2
          })
        })

        describe('after', function() {
          testBucket({
            bucketId: 2,
            bucketIndex: 1,
            bucketSize: 2,
            elements: [(MAX_BUCKET_SIZE - 1) * 2, MAX_BUCKET_SIZE * 2]
          })
        })
      })

      describe('when signer is greater than first element', function() {
        let element = 1
        const initialElements = []
        const testElements = []
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          // [1, 3, 5, ...]
          initialElements.push(element)
          testElements.push(element)
          element += 2
        }

        testElements.splice(1, 0, 2)
        testElements.pop()

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(initialElements[i])
          }
        })

        describe('inserting ', function() {
          testInsertSigner({
            signer: 2,
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 0,
            totalBuckets: 2,
            elements: testElements
          })
        })

        describe('initial bucket', function() {
          testBucket({
            bucketId: 2,
            bucketSize: 1,
            bucketIndex: 1,
            elements: [MAX_BUCKET_SIZE * 2 - 1]
          })
        })
      })

      describe('when signer is less than first element', function() {
        let initialBucket = []
        let element = 2
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          // [2,4,6,...]
          initialBucket.push(element)
          element += 2
        }

        before(async function() {
          this.signerList = await SignerListTest.new()
          this.targetElements = [1]

          for (const element of initialBucket) {
            await this.signerList.insert(element)
          }
        })

        describe('inserting', function() {
          testInsertSigner({
            signer: 1,
            bucketId: 2,
            bucketSize: 1,
            bucketIndex: 0,
            totalBuckets: 2
          })
        })

        describe('initial bucket', function() {
          testBucket({
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 1,
            elements: initialBucket
          })
        })
      })

      describe(`when 3 full buckets are inserted`, function() {
        function testBucketInsertion({ bucketId, bucketIndex, totalBuckets, elementsToInsert }) {
          describe(`inserting bucket ${bucketId}`, function() {
            let bucketSize = 1
            for (const signer of elementsToInsert) {
              describe(`inserting ${signer}`, function() {
                testInsertSigner({
                  signer: signer,
                  bucketId: bucketId,
                  bucketSize: bucketSize,
                  bucketIndex: bucketIndex,
                  totalBuckets: totalBuckets
                })
              })

              bucketSize++
            }
          })
        }

        describe('when elements are inserted in ascended order', function() {
          let initialBuckets = {}
          let element = 1
          for (let k = 1; k <= 3; ++k) {
            initialBuckets[k] = []
            for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
              initialBuckets[k].push(element++)
            }
          }

          before(async function() {
            this.signerList = await SignerListTest.new()
          })

          testBucketInsertion({
            bucketId: 1,
            bucketIndex: 0,
            totalBuckets: 1,
            elementsToInsert: initialBuckets[1]
          })

          testBucketInsertion({
            bucketId: 2,
            bucketIndex: 1,
            totalBuckets: 2,
            elementsToInsert: initialBuckets[2]
          })

          testBucketInsertion({
            bucketId: 3,
            bucketIndex: 2,
            totalBuckets: 3,
            elementsToInsert: initialBuckets[3]
          })

          describe('after insertion', function() {
            testBucket({
              bucketId: 1,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 0,
              elements: initialBuckets[1]
            })

            testBucket({
              bucketId: 2,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 1,
              elements: initialBuckets[2]
            })

            testBucket({
              bucketId: 3,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 2,
              elements: initialBuckets[3]
            })
          })
        })

        describe('when elements are inserted in descended order', function() {
          let initialBuckets = {}
          let elementsToInsert = {}
          let element = 1
          for (let k = 1; k <= 3; ++k) {
            initialBuckets[k] = []
            elementsToInsert[k] = []
            for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
              initialBuckets[k].push(element)
              elementsToInsert[k].push(element)

              element++
            }

            elementsToInsert[k] = elementsToInsert[k].reverse()
          }

          before(async function() {
            this.signerList = await SignerListTest.new()
          })

          testBucketInsertion({
            bucketId: 1,
            bucketIndex: 0,
            totalBuckets: 1,
            elementsToInsert: elementsToInsert[3]
          })

          testBucketInsertion({
            bucketId: 2,
            bucketIndex: 0,
            totalBuckets: 2,
            elementsToInsert: elementsToInsert[2]
          })

          testBucketInsertion({
            bucketId: 3,
            bucketIndex: 0,
            totalBuckets: 3,
            elementsToInsert: elementsToInsert[1]
          })

          describe('after insertion', function() {
            testBucket({
              bucketId: 1,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 2,
              elements: initialBuckets[3]
            })

            testBucket({
              bucketId: 2,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 1,
              elements: initialBuckets[2]
            })

            testBucket({
              bucketId: 3,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 0,
              elements: initialBuckets[1]
            })
          })
        })

        describe('when elements are inserted in random order', function() {
          const random = initRandom(1)

          let initialBuckets = {}
          let elementsToInsert = {}
          let element = 1
          for (let k = 1; k <= 3; ++k) {
            initialBuckets[k] = []
            elementsToInsert[k] = []
            for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
              initialBuckets[k].push(element)
              elementsToInsert[k].push(element)

              element++
            }

            elementsToInsert[k].sort(() => random() - 0.5)
          }

          before(async function() {
            this.signerList = await SignerListTest.new()
          })

          testBucketInsertion({
            bucketId: 1,
            bucketIndex: 0,
            totalBuckets: 1,
            elementsToInsert: elementsToInsert[3]
          })

          testBucketInsertion({
            bucketId: 2,
            bucketIndex: 0,
            totalBuckets: 2,
            elementsToInsert: elementsToInsert[2]
          })

          testBucketInsertion({
            bucketId: 3,
            bucketIndex: 0,
            totalBuckets: 3,
            elementsToInsert: elementsToInsert[1]
          })

          describe('after insertion', function() {
            testBucket({
              bucketId: 1,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 2,
              elements: initialBuckets[3]
            })

            testBucket({
              bucketId: 2,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 1,
              elements: initialBuckets[2]
            })

            testBucket({
              bucketId: 3,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: 0,
              elements: initialBuckets[1]
            })
          })
        })
      })
    })

    describe('when list has 2 full buckets', function() {
      describe('when signer is less than 1st element of bucket #1', function() {
        let elements = []
        let element = 2
        for (let i = 0; i < MAX_BUCKET_SIZE * 2; ++i) {
          elements.push(element)
          element += 2
        }

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (const el of elements) {
            await this.signerList.insert(el)
          }
        })

        describe('inserting', function() {
          testInsertSigner({
            signer: 1,
            bucketId: 3,
            bucketSize: 1,
            bucketIndex: 0,
            totalBuckets: 3,
            elements: [1]
          })
        })

        describe('after', function() {
          testBucket({
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 1,
            elements: elements.slice(0, MAX_BUCKET_SIZE)
          })

          testBucket({
            bucketId: 2,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 2,
            elements: elements.slice(MAX_BUCKET_SIZE)
          })
        })
      })

      describe('when signer is greater than 1st element of bucket #1', function() {
        let elements = []
        let testElements = []
        let element = 2
        for (let i = 0; i < MAX_BUCKET_SIZE * 2; ++i) {
          elements.push(element)
          testElements.push(element)
          element += 2
        }

        testElements.splice(1, 0, 3)

        const testElements2 = testElements.slice(MAX_BUCKET_SIZE, MAX_BUCKET_SIZE * 2)

        testElements.splice(MAX_BUCKET_SIZE)

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (const el of elements) {
            await this.signerList.insert(el)
          }
        })

        describe('inserting', function() {
          testInsertSigner({
            signer: 3,
            bucketId: 1,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 0,
            totalBuckets: 3,
            elements: testElements
          })
        })

        describe('after', function() {
          testBucket({
            bucketId: 2,
            bucketSize: MAX_BUCKET_SIZE,
            bucketIndex: 1,
            elements: testElements2
          })

          testBucket({
            bucketId: 3,
            bucketSize: 1,
            bucketIndex: 2,
            elements: [MAX_BUCKET_SIZE * 2 * 2]
          })
        })
      })
    })
  })

  describe('removeSigner', function() {
    function testRemoval({ signers, testSignersFn, ascended, bucketId, bucketsLeft }) {
      let i = ascended ? 0 : signers.length - 1
      while (ascended ? i < signers.length : i >= 0) {
        const signer = signers[i]
        describe(`removing ${signer}`, function() {
          it('must remove signer', async function() {
            await this.signerList.remove(signer)
          })

          const testSigners = testSignersFn(signers, i)
          if (testSigners.length === 0) {
            it(`${bucketsLeft} buckets left`, async function() {
              assertBigNumberEquality(await this.signerList.getTotalBuckets(), bucketsLeft)
            })
          } else {
            it('must have correct elements', async function() {
              const bucket = await this.signerList.getBucketById(bucketId)
              let index = 0
              for (const signer of testSigners) {
                assertBigNumberEquality(bucket.elements[index], signer)
                index++
              }
            })
          }
        })
        i += ascended ? 1 : -1
      }
    }

    describe('removing from full bucket', function() {
      describe('in ascending order', function() {
        let element = 1
        let signers = []
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          signers.push(element)
          element++
        }

        before(async function() {
          this.signerList = await SignerListTest.new()
          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(signers[i])
          }
        })

        testRemoval({
          signers,
          testSignersFn: (s, i) => s.slice(i + 1),
          ascended: true,
          bucketsLeft: 0,
          bucketId: 1
        })
      })

      describe('in descending order', function() {
        let element = 1
        let signers = []
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          signers.push(element)
          element++
        }

        before(async function() {
          this.signerList = await SignerListTest.new()
          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(signers[i])
          }
        })

        testRemoval({
          signers,
          testSignersFn: (s, i) => s.slice(0, i),
          ascended: false,
          bucketsLeft: 0,
          bucketId: 1
        })
      })

      describe('in random order', function() {
        let element = 1
        let signers = []
        let shuffledSigners = []
        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          signers.push(element)
          shuffledSigners.push(element)
          element++
        }

        const random = initRandom(9)
        shuffledSigners.sort(() => random() - 0.5)

        before(async function() {
          this.signerList = await SignerListTest.new()
          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            await this.signerList.insert(signers[i])
          }
        })

        const testSigners = [...signers]

        testRemoval({
          signers: shuffledSigners,
          testSignersFn: (s, i) => {
            testSigners.splice(testSigners.findIndex(x => x === s[i]), 1)
            return testSigners
          },
          ascended: true,
          bucketsLeft: 0,
          bucketId: 1
        })
      })
    })

    describe('removing from 1 element bucket', function() {
      describe('when list has 1 bucket', function() {
        const signer = 1

        before(async function() {
          this.signerList = await SignerListTest.new()
          await this.signerList.insert(signer)
        })

        it('must remove signer', async function() {
          await this.signerList.remove(signer)
        })

        it('must have no buckets left', async function() {
          assertBigNumberEquality(await this.signerList.getTotalBuckets(), 0)
        })
      })
    })

    describe('removing all elements from bucket', function() {
      function runTests({ targetBucketId }) {
        let element = 1
        let initialSigners = {}
        const bucketsToCreate = 4

        for (let k = 0; k < bucketsToCreate; ++k) {
          initialSigners[k + 1] = []
          for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
            initialSigners[k + 1].push(element)
            element++
          }
        }

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (const id in initialSigners) {
            for (const signer of initialSigners[id]) {
              await this.signerList.insert(signer)
            }
          }
        })

        describe(`removing all elements from bucket ${targetBucketId}`, function() {
          testRemoval({
            signers: initialSigners[targetBucketId],
            testSignersFn: (s, i) => s.slice(i + 1),
            ascended: true,
            bucketsLeft: bucketsToCreate - 1,
            bucketId: targetBucketId
          })
        })

        describe('after bucket was removed', function() {
          let bucketIndex = 0
          for (const bucketId in initialSigners) {
            if (bucketId == targetBucketId) {
              continue
            }

            testBucket({
              bucketId: bucketId,
              bucketSize: MAX_BUCKET_SIZE,
              bucketIndex: bucketIndex,
              elements: initialSigners[bucketId]
            })

            bucketIndex++
          }
        })
      }

      describe('when target bucket is first', function() {
        runTests({ targetBucketId: 1 })
      })

      describe('when target bucket is last', function() {
        runTests({ targetBucketId: 4 })
      })
    })
  })

  describe('updateSigner', function() {
    function runTests(bucketSize) {
      describe('when first signer updated to be last', function() {
        let elements = []
        let testElements = []
        let element = 1
        for (let i = 0; i < bucketSize; ++i) {
          elements.push(element)
          testElements.push(element)
          element++
        }

        testElements.push(9999)
        testElements.splice(0, 1)

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (let i = 0; i < bucketSize; ++i) {
            await this.signerList.insert(elements[i])
          }
        })

        it('must update signer', async function() {
          await this.signerList.update(elements[0], testElements[testElements.length - 1])
        })

        it('must have 1 bucket in total', async function() {
          assertBigNumberEquality(await this.signerList.getTotalBuckets(), 1)
        })

        testBucket({
          bucketId: 1,
          bucketSize: bucketSize,
          bucketIndex: 0,
          elements: testElements
        })
      })

      describe('when last signer updated to be first', function() {
        let elements = []
        let testElements = []
        let element = 100
        for (let i = 0; i < bucketSize; ++i) {
          elements.push(element)
          testElements.push(element)
          element++
        }

        // insert to 0 index and remove last element
        testElements.splice(0, 0, 1)
        testElements.pop()

        before(async function() {
          this.signerList = await SignerListTest.new()

          for (let i = 0; i < bucketSize; ++i) {
            await this.signerList.insert(elements[i])
          }
        })

        it('must update signer', async function() {
          await this.signerList.update(elements[elements.length - 1], testElements[0])
        })

        it('must have 1 bucket in total', async function() {
          assertBigNumberEquality(await this.signerList.getTotalBuckets(), 1)
        })

        testBucket({
          bucketId: 1,
          bucketSize: bucketSize,
          bucketIndex: 0,
          elements: testElements
        })
      })
    }

    describe('when bucket is full', function() {
      runTests(MAX_BUCKET_SIZE)
    })

    describe('when bucket is half full', function() {
      runTests(MAX_BUCKET_SIZE / 2)
    })

    describe('when bucket has 1 element', function() {
      const element = 1
      const signer = 999

      before(async function() {
        this.signerList = await SignerListTest.new()

        await this.signerList.insert(element)
      })

      it('must update signer', async function() {
        await this.signerList.update(element, signer)
      })

      it('must have 1 bucket in total', async function() {
        assertBigNumberEquality(await this.signerList.getTotalBuckets(), 1)
      })

      testBucket({
        bucketId: 2,
        bucketSize: 1,
        bucketIndex: 0,
        elements: [signer]
      })
    })

    describe('when trying to update unknown signer', function() {
      before(async function() {
        this.signerList = await SignerListTest.new()

        for (let i = 0; i < MAX_BUCKET_SIZE; ++i) {
          await this.signerList.insert(i + 1)
        }
      })

      it('reverts', async function() {
        await expectRevert(this.signerList.update(999, 9999), 'not found')
      })
    })
  })
})
