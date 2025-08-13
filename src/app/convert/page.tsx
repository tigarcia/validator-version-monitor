"use client";
import { useState } from "react";
import { Validator } from "../../types/validator";
import Link from "next/link";

interface ConversionResult {
  originalKey: string;
  convertedKey: string;
  isError: boolean;
  errorMessage?: string;
}

export default function ConvertPage() {
  const [inputKeys, setInputKeys] = useState("");
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [conversionType, setConversionType] = useState<"identity" | "vote" | null>(null);

  const convertKeys = async () => {
    setIsConverting(true);
    setError("");
    setResults([]);
    setConversionType(null);

    try {
      // Get the validator data from the main page
      const response = await fetch("/api/validators");
      if (!response.ok) {
        throw new Error("Failed to fetch validator data");
      }
      const validators: Validator[] = await response.json();
      // Parse input keys
      const keys = inputKeys.trim().split('\n').filter(key => key.trim() !== '');

      if (keys.length === 0) {
        setError("Please enter at least one key");
        setIsConverting(false);
        return;
      }

      // Create maps for quick lookup
      const identityToVote = new Map<string, string>();
      const voteToIdentity = new Map<string, string>();

      validators.forEach(validator => {
        identityToVote.set(validator.identityPubkey, validator.voteAccountPubkey);
        voteToIdentity.set(validator.voteAccountPubkey, validator.identityPubkey);
      });

      // Determine key types and count
      let identityCount = 0;
      let voteCount = 0;
      const keyTypes: { [key: string]: 'identity' | 'vote' | 'unknown' } = {};

      keys.forEach(key => {
        if (identityToVote.has(key)) {
          keyTypes[key] = 'identity';
          identityCount++;
        } else if (voteToIdentity.has(key)) {
          keyTypes[key] = 'vote';
          voteCount++;
        } else {
          keyTypes[key] = 'unknown';
        }
      });

      // Check for 50/50 split
      if (identityCount === voteCount && identityCount > 0) {
        setError("Cannot determine conversion direction: equal number of identity and vote accounts");
        setIsConverting(false);
        return;
      }

      // Determine conversion direction
      const convertToVote = identityCount > voteCount;
      setConversionType(convertToVote ? "vote" : "identity");

      const conversionResults: ConversionResult[] = [];

      keys.forEach(key => {
        const keyType = keyTypes[key];

        if (keyType === 'unknown') {
          conversionResults.push({
            originalKey: key,
            convertedKey: key,
            isError: true,
            errorMessage: "Key not found in validator set"
          });
        } else if (convertToVote && keyType === 'identity') {
          const voteKey = identityToVote.get(key);
          conversionResults.push({
            originalKey: key,
            convertedKey: voteKey || key,
            isError: !voteKey
          });
        } else if (!convertToVote && keyType === 'vote') {
          const identityKey = voteToIdentity.get(key);
          conversionResults.push({
            originalKey: key,
            convertedKey: identityKey || key,
            isError: !identityKey
          });
        } else {
          // Key is already in the target format
          conversionResults.push({
            originalKey: key,
            convertedKey: key,
            isError: false
          });
        }
      });

      setResults(conversionResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during conversion");
    } finally {
      setIsConverting(false);
    }
  };

  const copyResults = () => {
    const outputText = results.filter(r => !r.isError).map(r => r.convertedKey).join('\n');
    navigator.clipboard.writeText(outputText);
  };

  return (
    <div className="min-h-screen bg-gray-100 px-8 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ← Back to Explorer
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Key Converter</h1>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Enter Identity or Vote Account Public Keys (one per line):
            </label>
            <textarea
              value={inputKeys}
              onChange={(e) => setInputKeys(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-lg text-gray-900 bg-white resize-none"
              placeholder="Enter public keys here, one per line..."
            />
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={convertKeys}
              disabled={isConverting || !inputKeys.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isConverting ? "Converting..." : "Convert Keys"}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Conversion Results:</h3>
              {/* Output Text Box */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-900">
                    {conversionType === "identity" ? "Identity Keys" : conversionType === "vote" ? "Vote Account Keys" : "Converted Keys"}:
                  </label>
                  <button
                    onClick={copyResults}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                  >
                    Copy All
                  </button>
                </div>
                <textarea
                  value={results.filter(r => !r.isError).map(r => r.convertedKey).join('\n')}
                  readOnly
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg text-gray-900 bg-gray-50 resize-none font-mono text-sm"
                />
              </div>

              {/* Error List */}
              {results.some(r => r.isError) && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-red-700 mb-2">Errors:</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    {results.filter(r => r.isError).map((result, index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        <div className="text-sm text-red-800 font-mono">
                          {result.originalKey}
                        </div>
                        {result.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">
                            {result.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion Summary */}
              <div className="text-sm text-gray-600">
                <p>
                  <strong>Summary:</strong> {results.filter(r => !r.isError).length} keys converted successfully,
                  {results.filter(r => r.isError).length} keys had errors.
                </p>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600">
            <h4 className="font-semibold mb-2">How it works:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Enter a list of identity or vote account public keys (one per line)</li>
              <li>The system will detect the majority type and convert all keys to the opposite type</li>
              <li>If the majority are identity accounts, all keys will be converted to vote accounts</li>
              <li>If the majority are vote accounts, all keys will be converted to identity accounts</li>
              <li>Keys that cannot be converted will be highlighted in red</li>
              <li>If there&apos;s an equal number of identity and vote accounts, an error will be shown</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
