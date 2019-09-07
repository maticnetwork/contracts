pragma solidity ^0.4.24;

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

	// validate validator set
  function validateValidatorSet(
    bytes vote,
    bytes sigs,
    bytes txBytes,
    bytes proof
  ) external;

	// Commit span
	function commitSpan(
		bytes vote,
		bytes sigs,
		bytes txBytes,
		bytes proof
	) external;
}
