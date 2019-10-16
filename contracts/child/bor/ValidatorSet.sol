pragma solidity ^0.5.2;

interface ValidatorSet {
	/// Get initial validator set
	function getInitialValidators()
		external
		view
		returns (address[] memory, uint256[] memory);

	/// Get current validator set (last enacted or initial if no changes ever made) with current stake.
	function getValidators()
		external
		view
		returns (address[] memory, uint256[] memory);

	// validate transaction
  function validateValidatorSet(
    bytes calldata vote,
    bytes calldata sigs,
    bytes calldata txBytes,
    bytes calldata proof
  ) external;

	// Commit span
	function commitSpan(
		bytes calldata vote,
		bytes calldata sigs,
		bytes calldata txBytes,
		bytes calldata proof
	) external;

	function getSpan(uint256 span) 
		external 
		view 
		returns (uint256 number, uint256 startBlock, uint256 endBlock);

  function getCurrentSpan() 
		external 
		view 
		returns (uint256 number, uint256 startBlock, uint256 endBlock);	
	
	function getNextSpan() 
		external 
		view 
		returns (uint256 number, uint256 startBlock, uint256 endBlock);	

	function currentSpanNumber() 
		external 
		view 
		returns (uint256);

  function getSpanByBlock(uint256 number) 
		external 
		view 
		returns (uint256);

  function getBorValidators(uint256 number) 
		external 
		view
		returns (address[] memory, uint256[] memory);
}
