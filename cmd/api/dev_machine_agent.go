package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/remote"
)

const devMachineAPIReconnectInterval = time.Second

// startDevMachineAPIConnector attaches the source-built local machine agent
// without putting its API key through the browser. It is reached only from the
// explicitly insecure local-development configuration and accepts loopback
// endpoints only, which keeps the production registration boundary unchanged.
func startDevMachineAPIConnector(ctx context.Context, machine *config.DevMachineAPI, servers *remote.Manager, logger *slog.Logger) {
	if machine == nil {
		return
	}
	go func() {
		waitingLogged := false
		for {
			attempt, cancel := context.WithTimeout(ctx, 2*time.Second)
			err := connectDevMachineAPI(attempt, machine, servers)
			cancel()
			if err == nil {
				logger.Info("connected local development machine API", "address", machine.APIURL, "name", machine.Name, "port", machine.Port)
				for index := range machine.APIKey {
					machine.APIKey[index] = 0
				}
				return
			}
			if !waitingLogged {
				logger.Info("waiting for local development machine API", "address", machine.APIURL, "name", machine.Name, "port", machine.Port)
				waitingLogged = true
			}
			timer := time.NewTimer(devMachineAPIReconnectInterval)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C:
			}
		}
	}()
}

func connectDevMachineAPI(ctx context.Context, machine *config.DevMachineAPI, servers *remote.Manager) error {
	for _, profile := range servers.List() {
		if profile.ConnectionType != remote.ConnectionAgentAPI || profile.APIURL != machine.APIURL || profile.Port != machine.Port || profile.TLSCertificateFingerprint != machine.TLSCertificateFingerprint {
			continue
		}
		if profile.ConnectionState == "connected" {
			return nil
		}
		_, err := servers.Connect(ctx, profile.ID, remote.Credentials{
			APIKey:         string(machine.APIKey),
			Authentication: remote.AuthenticationAPIKey,
		})
		return err
	}
	_, err := servers.Add(ctx, remote.AddInput{
		APIKey:                    string(machine.APIKey),
		APIURL:                    machine.APIURL,
		Name:                      machine.Name,
		Port:                      machine.Port,
		TLSCertificateFingerprint: machine.TLSCertificateFingerprint,
	})
	return err
}
