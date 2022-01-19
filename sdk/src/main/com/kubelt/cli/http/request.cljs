(ns com.kubelt.cli.http.request
  "Invoke the SDK (init) method."
  {:copyright "©2022 Kubelt, Inc." :license "UNLICENSED"}
  (:require
   [com.kubelt.sdk.v1 :as sdk]))

(defonce command
  {:command "request"
   :desc "Perform HTTP request"
   :requiresArg false

   :builder (fn [^Yargs yargs]
              yargs)

   :handler (fn [args]
              (let [kbt (sdk/init)]
                (if (sdk/error? kbt)
                  (prn (:error kbt))
                  (let []
                    (println "TODO perform request")
                    (sdk/halt! kbt)))))})
