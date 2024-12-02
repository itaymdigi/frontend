import React, { useState, useEffect } from 'react';
import { Upload, User, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

interface RecognizedFace {
  name: string;
  reference_image: string;
  detected_face: string;
}

interface RecognitionResult {
  faces_found: number;
  recognized_faces: RecognizedFace[];
}

interface ReferenceUploadResponse {
  message: string;
  name: string;
  faces_found: number;
  face_image: string;
}

interface ErrorResponse {
  error: string;
}

// Logger utility
const Logger = {
  group: (name: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔍 ${name}`);
    }
  },
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      const formattedData = data ? JSON.stringify(data, null, 2) : '';
      console.log(`📝 ${message}`, formattedData);
    }
  },
  success: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      const formattedData = data ? JSON.stringify(data, null, 2) : '';
      console.log(`✅ ${message}`, formattedData);
    }
  },
  error: (message: string, error?: any) => {
    if (process.env.NODE_ENV === 'development') {
      const formattedError = error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(`❌ ${message}`, JSON.stringify(formattedError, null, 2));
    }
  },
  groupEnd: () => {
    if (process.env.NODE_ENV === 'development') {
      console.groupEnd();
    }
  }
};

function App() {
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [results, setResults] = useState<RecognitionResult | null>(() => {
    const savedResults = localStorage.getItem('lastResults');
    return savedResults ? JSON.parse(savedResults) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const savedStep = localStorage.getItem('currentStep');
    return savedStep ? parseInt(savedStep) : 1;
  });
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    localStorage.setItem('currentStep', currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    if (results) {
      localStorage.setItem('lastResults', JSON.stringify(results));
    }
  }, [results]);

  const handleReferenceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceImage || !name) {
      toast.error('Please provide both a name and an image');
      return;
    }

    Logger.group('Reference Face Upload');
    Logger.log('Starting upload process', {
      name,
      fileName: referenceImage.name,
      fileSize: `${(referenceImage.size / 1024).toFixed(2)} KB`,
      fileType: referenceImage.type
    });

    const loadingToast = toast.loading('Adding reference face...');
    setLoading(true);
    setError('');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', referenceImage);
    formData.append('name', name);

    try {
      Logger.log('Sending request to server', {
        endpoint: 'http://localhost:5000/api/upload-reference',
        method: 'POST',
        fileName: referenceImage.name,
        name: name,
        fileSize: `${(referenceImage.size / 1024).toFixed(2)} KB`,
        fileType: referenceImage.type
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const response = await fetch('http://localhost:5000/api/upload-reference', {
        method: 'POST',
        body: formData,
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'omit'
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      Logger.log('Server response received', { 
        status: response.status,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        Logger.error('Server error response', errorData);
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data: ReferenceUploadResponse = await response.json();
      Logger.success('Upload completed successfully', {
        facesFound: data.faces_found,
        name: data.name,
        message: data.message
      });

      toast.success('Reference face added successfully!', {
        id: loadingToast,
      });
      
      setReferenceImage(null);
      setName('');
      setError('');
      setUploadSuccess(true);
      setCurrentStep(2);
      // Clear previous results when adding new reference
      setResults(null);
      localStorage.removeItem('lastResults');
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      Logger.error('Upload failed', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        toast.error('Could not connect to server. Please ensure the server is running.', {
          id: loadingToast,
        });
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to upload reference image', {
          id: loadingToast,
        });
      }
    } finally {
      setLoading(false);
      Logger.groupEnd();
    }
  };

  const handleRecognition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetImage) {
      toast.error('Please select an image');
      return;
    }

    Logger.group('Face Recognition');
    Logger.log('Starting recognition process', {
      fileName: targetImage.name,
      fileSize: `${(targetImage.size / 1024).toFixed(2)} KB`,
      fileType: targetImage.type
    });

    const loadingToast = toast.loading('Processing image...');
    setLoading(true);
    setError('');
    setResults(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', targetImage);

    try {
      Logger.log('Sending request to server', {
        endpoint: 'http://localhost:5000/api/recognize',
        method: 'POST',
        fileName: targetImage.name,
        fileSize: `${(targetImage.size / 1024).toFixed(2)} KB`,
        fileType: targetImage.type
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('http://localhost:5000/api/recognize', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const responseData = await response.json();
      
      if (!response.ok) {
        const errorData = responseData as ErrorResponse;
        throw new Error(errorData.error || 'Failed to process image');
      }

      const data = responseData as RecognitionResult;
      Logger.success('Recognition completed successfully', {
        facesFound: data.faces_found,
        recognizedNames: data.recognized_faces.map((face: RecognizedFace) => face.name),
        processingTime: `${Date.now() - performance.now()}ms`
      });

      setResults(data);
      toast.success(`Found ${data.faces_found} face(s)!`, {
        id: loadingToast,
      });
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      Logger.error('Recognition failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process image', {
        id: loadingToast,
      });
    } finally {
      setLoading(false);
      Logger.groupEnd();
    }
  };

  const resetApp = () => {
    setCurrentStep(1);
    setResults(null);
    setTargetImage(null);
    setReferenceImage(null);
    setName('');
    setError('');
    setUploadSuccess(false);
    setUploadProgress(0);
    localStorage.removeItem('lastResults');
    localStorage.removeItem('currentStep');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Face Recognition App
        </h1>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${currentStep === 1 ? 'text-blue-600' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                ${currentStep === 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                1
              </div>
              <span className="ml-2">Add Reference</span>
            </div>
            <div className={`w-16 h-0.5 ${currentStep === 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`flex items-center ${currentStep === 2 ? 'text-blue-600' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                ${currentStep === 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                2
              </div>
              <span className="ml-2">Recognize Face</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-1 gap-8">
          {/* Step 1: Reference Image Upload */}
          {currentStep === 1 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Add Reference Face
              </h2>
              <form onSubmit={handleReferenceUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Enter name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Image
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-md"
                      accept="image/*"
                    />
                    <Upload className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center gap-2
                    ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  {loading ? 'Adding Face...' : 'Add Face'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Recognition */}
          {currentStep === 2 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Recognize Face
                </h2>
                <button
                  onClick={resetApp}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  Add Another Reference
                </button>
              </div>
              <form onSubmit={handleRecognition} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Image
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={(e) => setTargetImage(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border rounded-md"
                      accept="image/*"
                    />
                    <ImageIcon className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center gap-2
                    ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                  {loading ? 'Processing...' : 'Recognize Face'}
                </button>
              </form>

              {results && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-md">
                    <h3 className="font-medium mb-2">Results:</h3>
                    <p>Faces found: {results.faces_found}</p>
                  </div>

                  {results.recognized_faces.map((face, index) => (
                    <div key={index} className="p-4 bg-white rounded-md shadow-sm">
                      <h4 className="font-medium text-lg mb-3">
                        Recognized: {face.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Reference Photo:</p>
                          <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
                            <img
                              src={`data:image/jpeg;base64,${face.reference_image}`}
                              alt={`Reference of ${face.name}`}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Detected Face:</p>
                          <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
                            <img
                              src={`data:image/jpeg;base64,${face.detected_face}`}
                              alt={`Detected ${face.name}`}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {uploadProgress > 0 && (
          <div className="fixed bottom-4 right-4 w-64">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
